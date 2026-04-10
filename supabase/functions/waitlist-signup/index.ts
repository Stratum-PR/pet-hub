import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { corsJsonHeaders } from "../_shared/waitlist_cors.ts";
import { confirmationEmail, sendResendEmail } from "../_shared/waitlist_email_html.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: string;
  locale?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  metadata?: Record<string, unknown>;
};

function functionsBase(): string {
  const u = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  return `${u}/functions/v1`;
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

  const locale = body.locale === "en" ? "en" : "es";
  const source = ["website", "social", "referral", "direct"].includes(body.source ?? "")
    ? (body.source as string)
    : "website";
  const utm_source = body.utm_source?.trim().slice(0, 200) ?? null;
  const utm_medium = body.utm_medium?.trim().slice(0, 200) ?? null;
  const utm_campaign = body.utm_campaign?.trim().slice(0, 200) ?? null;
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

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
  }

  const confirmUrl = `${functionsBase()}/waitlist-confirm?token=${encodeURIComponent(confirmToken)}`;
  const { subject, html } = confirmationEmail({ confirmUrl, locale });
  const sent = await sendResendEmail({ to: rawEmail, subject, html });
  if (!sent.ok) {
    console.error("Resend waitlist confirmation", sent.status, sent.body);
    return new Response(JSON.stringify({ error: "email_send_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...cors },
    });
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
