// support-contact
// Help page contact form → email to the support inbox (Resend), with Reply-To set to the sender
// so the team can answer straight from their mail client.
//
// Security: requires a signed-in user (JWT verified by the platform and here). Sender identity,
// business and account come from the session, not from the form. Max 5 messages per user per hour.
//
// Emails: (1) to the support inbox, Reply-To = the customer; (2) a copy to the customer's account email,
// both sent FROM support@grumi.pet so replies land in the Support inbox. If grumi.pet isn't verified in
// Resend yet, the sender falls back to FALLBACK_FROM so nothing is lost.
//
// Secrets: RESEND_API_KEY (or NOTIFY_RESEND_API_KEY), SUPPORT_INBOX_EMAIL (default support@grumi.pet),
//          SUPPORT_FROM_EMAIL (default "Grumi Soporte <support@grumi.pet>").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const TOPICS: Record<string, string> = {
  question: "Pregunta",
  problem: "Problema técnico",
  billing: "Facturación",
  suggestion: "Sugerencia",
  other: "Otro",
};
const recentByUser = new Map<string, number[]>();
const SUPPORT_INBOX = () => Deno.env.get("SUPPORT_INBOX_EMAIL") ?? "support@grumi.pet";
const SUPPORT_FROM = () => Deno.env.get("SUPPORT_FROM_EMAIL") ?? "Grumi Soporte <support@grumi.pet>";
const FALLBACK_FROM = "Grumi <noreply@stratumpr.com>";

/** Sends via Resend from `from`; if that sender's domain isn't verified yet, retries from FALLBACK_FROM. */
async function sendEmail(resendKey: string, from: string, payload: Record<string, unknown>): Promise<Response> {
  const post = (sender: string) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, from: sender }),
    });
  const res = await post(from);
  if (res.ok || from === FALLBACK_FROM) return res;
  const body = await res.text();
  if ((res.status === 403 || res.status === 422) && /domain/i.test(body) && /verif/i.test(body)) {
    console.warn("support-contact: sender domain not verified yet, using fallback sender");
    return post(FALLBACK_FROM);
  }
  return new Response(body, { status: res.status });
}

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

  const res = await sendEmail(resendKey, SUPPORT_FROM(), {
    to: [SUPPORT_INBOX()],
    reply_to: replyTo,
    subject,
    text: `${details.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#1f2937">
        <table style="font-size:13px;border-collapse:collapse;margin-bottom:16px">
          ${details.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6b7280">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
        </table>
        <div style="white-space:pre-wrap;line-height:1.6;font-size:14px;border-top:1px solid #e5e7eb;padding-top:12px">${esc(message)}</div>
      </div>`,
  });
  if (!res.ok) {
    console.error("support-contact resend error", res.status, await res.text());
    return json(req, 502, { error: "send_failed" });
  }

  // Copy to the customer, from support@ so their reply goes to the Support inbox.
  const copy = await sendEmail(resendKey, SUPPORT_FROM(), {
    to: [replyTo],
    reply_to: SUPPORT_INBOX(),
    subject: `Recibimos tu mensaje · Grumi`,
    text: `Hola,\n\nRecibimos tu mensaje (${TOPICS[topic]}) y te responderemos a este correo lo antes posible. Si quieres añadir algo, responde a este email.\n\nTu mensaje:\n${message}\n\nEquipo de Grumi`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2937;line-height:1.6">
        <p>Hola,</p>
        <p>Recibimos tu mensaje (<strong>${esc(TOPICS[topic])}</strong>) y te responderemos a este correo lo antes posible. Si quieres añadir algo, responde a este email.</p>
        <div style="white-space:pre-wrap;font-size:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:16px 0">${esc(message)}</div>
        <p style="color:#6b7280;font-size:13px">Equipo de Grumi</p>
      </div>`,
  });
  if (!copy.ok) console.error("support-contact copy to customer failed", copy.status, await copy.text());

  recent.push(now);
  recentByUser.set(user.id, recent);
  return json(req, 200, { sent: true });
});
