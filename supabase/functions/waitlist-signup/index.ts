/**
 * Waitlist signup — single file (Supabase dashboard/remote bundle often only ships index.ts).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

// --- CORS ---
function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return origin;
  }
  const allowed = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (allowed) {
    const origins = allowed.split(",").map((o) => o.trim()).filter(Boolean);
    if (origins.includes(origin)) return origin;
    if (origins.length > 0) return origins[0]!;
  }
  return origin || "*";
}

function corsJsonHeaders(req: Request, methods = "POST, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// --- Resend: confirmation email only ---
const FROM = "Grumi <noreply@stratumpr.com>";

function resendFrom(): string {
  return Deno.env.get("RESEND_FROM_EMAIL")
    ? `${Deno.env.get("RESEND_FROM_NAME") ?? "Grumi"} <${Deno.env.get("RESEND_FROM_EMAIL")}>`
    : FROM;
}

function footer(es: boolean): string {
  const line = "Stratum PR LLC · Trujillo Alto, PR";
  const unsub = es
    ? "Si no solicitaste esto, ignora este correo."
    : "If you did not request this, you can ignore this email.";
  return `<p style="color:#9ca3af;font-size:11px;margin-top:24px;">${line}<br/>${unsub}</p>`;
}

function confirmationHtmlEs(confirmUrl: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <p style="font-size:18px;font-weight:700;color:#0f1923;margin:0 0 12px;">Grumi</p>
  <p style="color:#1f2937;line-height:1.6;">¡Gracias por tu interés en Grumi!</p>
  <p style="color:#4b5563;line-height:1.6;">Grumi es software para gestionar citas, clientes y tu negocio de grooming en Puerto Rico. Confirma tu correo para quedar en la lista de espera.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:#D4FF00;color:#0f1923;text-decoration:none;border-radius:9999px;font-weight:700;">Confirmar mi email</a>
  </div>
  <p style="color:#374151;font-size:14px;">Al confirmar, aseguras tu <strong>Precio Fundador</strong>: 25% de descuento en tu primer año al lanzar.</p>
  <p style="color:#4b5563;font-size:14px;line-height:1.5;">Al hacer clic en el botón, abriremos Grumi en tu navegador: ahí podrás, si quieres, responder unas preguntas cortas (opcional) para ayudarnos a priorizar lo que más necesitas.</p>
  ${footer(true)}
</div>`;
}

function confirmationHtmlEn(confirmUrl: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <p style="font-size:18px;font-weight:700;color:#0f1923;margin:0 0 12px;">Grumi</p>
  <p style="color:#1f2937;line-height:1.6;">Thanks for your interest in Grumi!</p>
  <p style="color:#4b5563;line-height:1.6;">Grumi helps pet grooming businesses run appointments and clients in one place. Confirm your email to join the waitlist.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:#D4FF00;color:#0f1923;text-decoration:none;border-radius:9999px;font-weight:700;">Confirm my email</a>
  </div>
  <p style="color:#374151;font-size:14px;">When you confirm, you lock in the <strong>Founder's Price</strong>: 25% off your first year at launch.</p>
  <p style="color:#4b5563;font-size:14px;line-height:1.5;">After you click the button, we'll open Grumi in your browser where you can optionally answer a few quick questions to help us prioritize what you need most.</p>
  ${footer(false)}
</div>`;
}

function confirmationEmail(params: { confirmUrl: string; locale: string }): { subject: string; html: string } {
  const es = params.locale === "es";
  const subject = es
    ? "Confirma tu lugar en la lista de espera de Grumi"
    : "Confirm your spot on the Grumi waitlist";
  const html = es ? confirmationHtmlEs(params.confirmUrl) : confirmationHtmlEn(params.confirmUrl);
  return { subject, html };
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom(),
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

// --- Handler ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: string;
  full_name?: string;
  business_name?: string;
  locale?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: Record<string, unknown>;
  /** Optional: e.g. http://localhost:8080 — appended to confirm link if allowlisted (local/staging). */
  redirect_after_confirm?: string;
};

function functionsBase(): string {
  const u = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  return `${u}/functions/v1`;
}

function normalizeRedirectOrigin(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isAllowedRedirectOrigin(origin: string): boolean {
  const site = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").trim();
  if (site) {
    try {
      if (new URL(site).origin === origin) return true;
    } catch {
      /* ignore */
    }
  }
  const extra = Deno.env.get("WAITLIST_ALLOWED_REDIRECT_ORIGINS")?.trim() ?? "";
  for (const chunk of extra.split(",").map((x) => x.trim()).filter(Boolean)) {
    try {
      if (new URL(chunk).origin === origin) return true;
    } catch {
      /* ignore */
    }
  }
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

Deno.serve(async (req) => {
  const cors = corsJsonHeaders(req, "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const rawEmail = (body.email ?? "").trim().toLowerCase();
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return new Response(JSON.stringify({ error: "invalid_email", messageKey: "waitlist.errorInvalidEmail" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const full_name = (body.full_name ?? "").trim().slice(0, 120);
  const business_name = (body.business_name ?? "").trim().slice(0, 200);
  if (full_name.length < 2 || business_name.length < 2) {
    return new Response(
      JSON.stringify({ error: "invalid_input", messageKey: "waitlist.errorRequiredProfile" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      },
    );
  }

  const locale = body.locale === "en" ? "en" : "es";
  const source = ["website", "social", "referral", "direct"].includes(body.source ?? "")
    ? (body.source as string)
    : "website";
  const utm_source = body.utm_source?.trim().slice(0, 200) ?? null;
  const utm_medium = body.utm_medium?.trim().slice(0, 200) ?? null;
  const utm_campaign = body.utm_campaign?.trim().slice(0, 200) ?? null;
  const safeMeta =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  const metadata: Record<string, unknown> = { ...safeMeta, full_name, business_name };

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: selErr } = await admin
    .from("waitlist")
    .select("id,email,confirmed,confirm_token,locale")
    .eq("email", rawEmail)
    .maybeSingle();

  if (selErr) {
    console.error("waitlist select", selErr);
    return new Response(JSON.stringify({ error: "database_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (existing?.confirmed) {
    return new Response(
      JSON.stringify({
        success: true,
        alreadyRegistered: true,
        waitlist_id: existing.id,
        messageKey: "waitlist.alreadyRegistered",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  let waitlistId: string;
  let confirmToken: string;
  /** True only when a new waitlist row was inserted (not a resend to an unconfirmed email). */
  let isNewSignup = false;

  if (existing && !existing.confirmed) {
    const newToken = crypto.randomUUID();
    const { error: upErr } = await admin
      .from("waitlist")
      .update({
        confirm_token: newToken,
        locale,
        source,
        utm_source,
        utm_medium,
        utm_campaign,
        metadata,
        signed_up_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (upErr) {
      console.error("waitlist update", upErr);
      return new Response(JSON.stringify({ error: "database_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    waitlistId = existing.id;
    confirmToken = newToken;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("waitlist")
      .insert({
        email: rawEmail,
        locale,
        source,
        utm_source,
        utm_medium,
        utm_campaign,
        metadata,
      })
      .select("id,confirm_token")
      .single();

    if (insErr || !inserted) {
      console.error("waitlist insert", insErr);
      return new Response(JSON.stringify({ error: "database_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    waitlistId = inserted.id;
    confirmToken = inserted.confirm_token as string;
    isNewSignup = true;
  }

  let confirmUrl = `${functionsBase()}/waitlist-confirm?token=${encodeURIComponent(confirmToken)}`;
  const rawRedirect =
    typeof body.redirect_after_confirm === "string" ? body.redirect_after_confirm.trim() : "";
  if (rawRedirect) {
    const o = normalizeRedirectOrigin(rawRedirect);
    if (o && isAllowedRedirectOrigin(o)) {
      confirmUrl += `&redirect_to=${encodeURIComponent(o)}`;
    }
  }
  const { subject, html } = confirmationEmail({ confirmUrl, locale });
  const sent = await sendResendEmail({ to: rawEmail, subject, html });
  if (!sent.ok) {
    console.error("Resend waitlist confirmation", sent.status, sent.body);
    return new Response(JSON.stringify({ error: "email_send_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (isNewSignup) {
    const notifyTo = Deno.env.get("WAITLIST_NOTIFY_EMAIL")?.trim() ?? "";
    if (notifyTo && EMAIL_RE.test(notifyTo)) {
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const adminHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0;padding:16px;">
  <p style="font-weight:700;color:#0f1923;margin:0 0 12px;">New Grumi waitlist signup</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Name:</strong> ${esc(full_name)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Business:</strong> ${esc(business_name)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Email:</strong> ${esc(rawEmail)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Locale:</strong> ${esc(locale)}</p>
  <p style="color:#374151;margin:0;"><strong>Source:</strong> ${esc(source)}</p>
</div>`;
      const n = await sendResendEmail({
        to: notifyTo,
        subject: `New waitlist: ${rawEmail}`,
        html: adminHtml,
      });
      if (!n.ok) {
        console.error("Resend waitlist admin notify", n.status, n.body);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      waitlist_id: waitlistId,
      messageKey: "waitlist.checkEmail",
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...cors } },
  );
});
