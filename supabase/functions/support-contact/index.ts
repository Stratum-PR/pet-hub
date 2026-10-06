// support-contact
// Help page contact form → email to the support inbox (Resend), with Reply-To set to the sender
// so the team can answer straight from their mail client.
//
// Security: requires a signed-in user (JWT verified by the platform and here). Sender identity,
// business and account come from the session, not from the form. Max 5 messages per user per hour.
//
// Secrets: RESEND_API_KEY (or NOTIFY_RESEND_API_KEY), SUPPORT_INBOX_EMAIL (default support@grumi.pet),
//          NOTIFY_FROM_EMAIL (default "Grumi <noreply@stratumpr.com>"), ALLOWED_ORIGINS (optional).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const TOPICS: Record<string, string> = {
  question: "Pregunta",
  problem: "Problema técnico",
  billing: "Facturación",
  suggestion: "Sugerencia",
  other: "Otro",
};
const recentByUser = new Map<string, number[]>();

function corsHeaders(req: Request): Record<string, string> {
  // Access is controlled by the signed-in user's JWT, so the caller's origin and requested headers are echoed
  // (a fixed allow-list broke calls from dev.grumi.pet and from newer SDK headers).
  const origin = req.headers.get("Origin") ?? "*";
  const requested = req.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      requested ?? "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("NOTIFY_RESEND_API_KEY") || Deno.env.get("RESEND_API_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !resendKey) return json(req, 500, { error: "server_misconfigured" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, 401, { error: "unauthorized" });
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json(req, 401, { error: "unauthorized" });

  // Simple per-instance rate limit.
  const now = Date.now();
  const recent = (recentByUser.get(user.id) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 5) return json(req, 429, { error: "too_many_requests" });

  let body: { topic?: string; message?: string; page?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "invalid_json" });
  }
  const topic = TOPICS[String(body.topic ?? "")] ? String(body.topic) : "question";
  const message = String(body.message ?? "").trim();
  // Replies always go to the signed-in account's email.
  const replyTo = String(user.email ?? "").trim().toLowerCase();
  const page = String(body.page ?? "").slice(0, 300);
  if (message.length < 5 || message.length > 4000) return json(req, 400, { error: "invalid_message" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) return json(req, 400, { error: "invalid_email" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("role, business_id")
    .eq("id", user.id)
    .maybeSingle();
  const { data: business } = profile?.business_id
    ? await admin.from("businesses").select("name, slug").eq("id", profile.business_id).maybeSingle()
    : { data: null };

  const businessLabel = business ? `${business.name} (/${business.slug})` : "Sin negocio vinculado";
  const subject = `[Grumi · ${TOPICS[topic]}] ${business?.name ?? user.email ?? "Usuario"}`;
  const details: [string, string][] = [
    ["Tema", TOPICS[topic]],
    ["Negocio", businessLabel],
    ["Cuenta", `${user.email ?? "—"}${profile?.role ? ` · ${profile.role}` : ""}`],
    ["Responder a", replyTo],
    ["Página", page || "—"],
  ];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("NOTIFY_FROM_EMAIL") ?? "Grumi <noreply@stratumpr.com>",
      to: [Deno.env.get("SUPPORT_INBOX_EMAIL") ?? "support@grumi.pet"],
      reply_to: replyTo,
      subject,
      text: `${details.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#1f2937">
        <table style="font-size:13px;border-collapse:collapse;margin-bottom:16px">
          ${details.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6b7280">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
        </table>
        <div style="white-space:pre-wrap;line-height:1.6;font-size:14px;border-top:1px solid #e5e7eb;padding-top:12px">${esc(message)}</div>
      </div>`,
    }),
  });
  if (!res.ok) {
    console.error("support-contact resend error", res.status, await res.text());
    return json(req, 502, { error: "send_failed" });
  }

  recent.push(now);
  recentByUser.set(user.id, recent);
  return json(req, 200, { sent: true });
});
