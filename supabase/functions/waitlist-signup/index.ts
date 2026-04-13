/**
 * Waitlist signup — single opt-in: confirm immediately, welcome email, survey token + referral code.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

/** HTML escape for email bodies (single-file deploy; keep in sync with waitlist-admin-notify-drain). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Centered Grumi logo (absolute asset URL); no duplicate wordmark — logo asset includes the name. */
function grumiEmailBanner(base: string): string {
  const logo = `${base}/logo_grumi_theme.png`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
  <tr>
    <td align="center" style="padding:8px 0 0;">
      <img src="${logo}" width="132" alt="Grumi" style="display:block;max-width:140px;height:auto;border:0;margin:0 auto;" />
    </td>
  </tr>
</table>`;
}

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

const FROM = "Grumi <noreply@stratumpr.com>";

function resendFrom(): string {
  return Deno.env.get("RESEND_FROM_EMAIL")
    ? `${Deno.env.get("RESEND_FROM_NAME") ?? "Grumi"} <${Deno.env.get("RESEND_FROM_EMAIL")}>`
    : FROM;
}

function appPublicBase(): string {
  const env = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "").trim().replace(/\/$/, "");
  return env || "https://grumi.pet";
}

function footer(es: boolean): string {
  const line = "Stratum PR LLC · Trujillo Alto, PR";
  const unsub = es
    ? "Si no solicitaste esto, ignora este correo."
    : "If you did not request this, you can ignore this email.";
  return `<p style="color:#9ca3af;font-size:11px;margin-top:24px;">${line}<br/>${unsub}</p>`;
}

function welcomeHtmlEs(params: {
  appBase: string;
  fullName: string;
  shareUrl: string | null;
  joinedWithReferral: boolean;
}): string {
  const referralBonus = params.joinedWithReferral
    ? `<p style="color:#374151;font-size:14px;line-height:1.5;">Al unirte con un código de referido válido, el <strong>10% adicional</strong> se acumula con el Precio Fundador (25% off tu primer año) durante <strong>un mes</strong> una vez que activemos pagos, según los términos vigentes.</p>`
    : "";
  const linkBlock = params.shareUrl
    ? `<p style="color:#374151;font-size:14px;line-height:1.5;">Comparte tu enlace de referido (incluye tu código). Quien se registre contigo mantiene el Precio Fundador y el <strong>10% adicional</strong> por referido se acumula con ese 25% durante <strong>un mes</strong> cuando activemos pagos, según los términos vigentes.</p>
  <p style="color:#0f1923;font-size:14px;font-weight:600;word-break:break-all;background:#f3f4f6;padding:12px 16px;border-radius:12px;">${esc(params.shareUrl)}</p>`
    : "";
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  ${grumiEmailBanner(params.appBase)}
  <p style="color:#1f2937;line-height:1.6;margin:0 0 16px;">Gracias por unirte a Grumi: nos alegra tenerte con nosotros mientras construimos la plataforma.</p>
  <p style="color:#1f2937;line-height:1.6;">¡Hola ${esc(params.fullName)}!</p>
  <p style="color:#4b5563;line-height:1.6;">Ya estás en la lista de espera de Grumi. Te avisaremos cuando abramos acceso.</p>
  <p style="color:#374151;font-size:14px;">Tu lugar incluye el <strong>Precio Fundador</strong>: 25% de descuento en tu primer año al lanzar.</p>
  ${referralBonus}
  <p style="color:#4b5563;font-size:14px;line-height:1.5;">En el sitio puedes responder unas preguntas cortas (opcional) para ayudarnos a priorizar lo que más necesitas.</p>
  ${linkBlock}
  ${footer(true)}
</div>`;
}

function welcomeHtmlEn(params: {
  appBase: string;
  fullName: string;
  shareUrl: string | null;
  joinedWithReferral: boolean;
}): string {
  const referralBonus = params.joinedWithReferral
    ? `<p style="color:#374151;font-size:14px;line-height:1.5;">Because you joined with a valid referral code, the <strong>extra 10% off</strong> stacks with Founder's Price (25% off your first year) for <strong>one month</strong> once billing is live, subject to the terms in effect.</p>`
    : "";
  const linkBlock = params.shareUrl
    ? `<p style="color:#374151;font-size:14px;line-height:1.5;">Share your referral link (it includes your code). Anyone who joins through you keeps Founder's Price, and the <strong>referral 10% off</strong> stacks with that 25% for <strong>one month</strong> once billing is live, subject to the terms in effect:</p>
  <p style="color:#0f1923;font-size:14px;font-weight:600;word-break:break-all;background:#f3f4f6;padding:12px 16px;border-radius:12px;">${esc(params.shareUrl)}</p>`
    : "";
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  ${grumiEmailBanner(params.appBase)}
  <p style="color:#1f2937;line-height:1.6;margin:0 0 16px;">Thank you for joining Grumi — we are glad you are with us as we build the platform.</p>
  <p style="color:#1f2937;line-height:1.6;">Hi ${esc(params.fullName)},</p>
  <p style="color:#4b5563;line-height:1.6;">You are on the Grumi waitlist. We will let you know when access opens.</p>
  <p style="color:#374151;font-size:14px;">Your spot locks in <strong>Founder's Price</strong>: 25% off your first year at launch.</p>
  ${referralBonus}
  <p style="color:#4b5563;font-size:14px;line-height:1.5;">On the site you can answer a few optional questions to help us prioritize what you need most.</p>
  ${linkBlock}
  ${footer(false)}
</div>`;
}

function welcomeEmail(params: {
  locale: string;
  appBase: string;
  fullName: string;
  shareUrl: string | null;
  joinedWithReferral: boolean;
}): { subject: string; html: string } {
  const es = params.locale === "es";
  const subject = es ? "Bienvenido a la lista de espera de Grumi" : "Welcome to the Grumi waitlist";
  const html = es
    ? welcomeHtmlEs({
      appBase: params.appBase,
      fullName: params.fullName,
      shareUrl: params.shareUrl,
      joinedWithReferral: params.joinedWithReferral,
    })
    : welcomeHtmlEn({
      appBase: params.appBase,
      fullName: params.fullName,
      shareUrl: params.shareUrl,
      joinedWithReferral: params.joinedWithReferral,
    });
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
  /** Referrer's public code (same as referral_code on their row). */
  ref?: string;
  referral_code?: string;
};

function slugFromBusinessName(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return ascii.length >= 2 ? ascii : "salon";
}

function randomSuffix(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function ensureUniqueReferralCode(
  admin: ReturnType<typeof createClient>,
  businessName: string,
): Promise<string> {
  const base = slugFromBusinessName(businessName);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `${base}-${randomSuffix(5)}`;
    const { data: clash } = await admin.from("waitlist").select("id").eq("referral_code", code).maybeSingle();
    if (!clash) return code;
  }
  return `${base}-${randomSuffix(8)}`;
}

const REFERRAL_CODE_STRING_MAX = 96;

/** Persist the exact code string used when referred_by is set; keep prior value on profile completion if ref not re-sent. */
function resolveReferredByCode(params: {
  resolvedReferredBy: string | null;
  lookupReferrerId: string | null;
  refRaw: string;
  existingReferredByCode: string | null | undefined;
}): string | null {
  if (!params.resolvedReferredBy) return null;
  if (
    params.lookupReferrerId &&
    params.lookupReferrerId === params.resolvedReferredBy &&
    params.refRaw.length > 0
  ) {
    return params.refRaw.slice(0, REFERRAL_CODE_STRING_MAX);
  }
  const prev = (params.existingReferredByCode ?? "").trim();
  return prev.length > 0 ? prev.slice(0, REFERRAL_CODE_STRING_MAX) : null;
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

  const refRaw = (body.ref ?? body.referral_code ?? "").trim().toLowerCase();
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let referredById: string | null = null;
  if (refRaw.length >= 2) {
    const { data: refRow } = await admin
      .from("waitlist")
      .select("id,email")
      .eq("referral_code", refRaw)
      .maybeSingle();
    if (refRow && typeof refRow.id === "string" && refRow.email !== rawEmail) {
      referredById = refRow.id;
    }
  }

  const { data: existing, error: selErr } = await admin
    .from("waitlist")
    .select("id,email,confirmed,locale,survey_token,referral_code,referred_by,referred_by_code")
    .eq("email", rawEmail)
    .maybeSingle();

  if (selErr) {
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

  const now = new Date().toISOString();
  const surveyToken = crypto.randomUUID();
  let waitlistId: string;
  let referralCode: string;
  let isFirstCompletion = false;

  if (existing && !existing.confirmed) {
    waitlistId = existing.id;
    referralCode =
      typeof existing.referral_code === "string" && existing.referral_code.length > 0
        ? existing.referral_code
        : await ensureUniqueReferralCode(admin, business_name);

    const resolvedReferredBy =
      (existing.referred_by as string | null) ??
      (referredById && referredById !== existing.id ? referredById : null);

    let referred_by_code = resolveReferredByCode({
      resolvedReferredBy,
      lookupReferrerId: referredById,
      refRaw,
      existingReferredByCode: existing.referred_by_code as string | null | undefined,
    });
    if (resolvedReferredBy && !referred_by_code) {
      const { data: refParent } = await admin
        .from("waitlist")
        .select("referral_code")
        .eq("id", resolvedReferredBy)
        .maybeSingle();
      const rc = refParent?.referral_code;
      if (typeof rc === "string" && rc.trim()) {
        referred_by_code = rc.trim().toLowerCase().slice(0, REFERRAL_CODE_STRING_MAX);
      }
    }

    const { error: upErr } = await admin
      .from("waitlist")
      .update({
        locale,
        source: resolvedReferredBy ? "referral" : source,
        utm_source,
        utm_medium,
        utm_campaign,
        metadata,
        signed_up_at: now,
        confirmed: true,
        confirmed_at: now,
        survey_token: existing.survey_token ?? surveyToken,
        referral_code: referralCode,
        referred_by: resolvedReferredBy,
        referred_by_code,
      })
      .eq("id", existing.id);

    if (upErr) {
      return new Response(JSON.stringify({ error: "database_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    isFirstCompletion = true;
  } else {
    referralCode = await ensureUniqueReferralCode(admin, business_name);

    const referred_by_code_new = resolveReferredByCode({
      resolvedReferredBy: referredById,
      lookupReferrerId: referredById,
      refRaw,
      existingReferredByCode: null,
    });

    const { data: inserted, error: insErr } = await admin
      .from("waitlist")
      .insert({
        email: rawEmail,
        locale,
        source: referredById ? "referral" : source,
        utm_source,
        utm_medium,
        utm_campaign,
        metadata,
        confirmed: true,
        confirmed_at: now,
        survey_token: surveyToken,
        referral_code: referralCode,
        referred_by: referredById,
        referred_by_code: referred_by_code_new,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return new Response(JSON.stringify({ error: "database_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    waitlistId = inserted.id as string;
    if (referredById === waitlistId) {
      await admin.from("waitlist").update({ referred_by: null, referred_by_code: null }).eq("id", waitlistId);
    }
    isFirstCompletion = true;
  }

  const { data: rowOut } = await admin
    .from("waitlist")
    .select("survey_token,referral_code,referred_by,referred_by_code")
    .eq("id", waitlistId)
    .single();

  const finalSurveyToken = (rowOut?.survey_token as string) ?? surveyToken;
  const finalReferralCode = (rowOut?.referral_code as string) ?? referralCode;
  const joinedWithReferral =
    rowOut?.referred_by !== null &&
    rowOut?.referred_by !== undefined &&
    String(rowOut.referred_by).length > 0;
  const base = appPublicBase();
  const referral_share_url = `${base}/?ref=${encodeURIComponent(finalReferralCode)}`;

  const { subject, html } = welcomeEmail({
    locale,
    appBase: base,
    fullName: full_name,
    shareUrl: referral_share_url,
    joinedWithReferral,
  });
  const sent = await sendResendEmail({ to: rawEmail, subject, html });
  if (!sent.ok) {
    return new Response(JSON.stringify({ error: "email_send_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (isFirstCompletion) {
    const deadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await admin
      .from("waitlist")
      .update({ admin_notify_at: deadline, signup_notify_deadline_at: deadline })
      .eq("id", waitlistId);
  }

  return new Response(
    JSON.stringify({
      success: true,
      waitlist_id: waitlistId,
      messageKey: "waitlist.welcomeJoined",
      survey_token: finalSurveyToken,
      referral_code: finalReferralCode,
      referral_share_url,
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...cors } },
  );
});
