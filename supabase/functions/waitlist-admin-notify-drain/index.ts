/**
 * Sends due internal waitlist notifications (Resend). Invoke on a schedule (e.g. every minute)
 * with header x-waitlist-notify-secret matching WAITLIST_NOTIFY_DRAIN_SECRET.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { adminWaitlistNotifyHtml } from "../_shared/waitlist-email-templates.ts";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

type WaitlistDueRow = {
  id: string;
  email: string;
  locale: string;
  source: string;
  metadata: Record<string, unknown> | null;
  referral_code: string | null;
  referred_by: string | null;
  referred_by_code: string | null;
  signup_notify_deadline_at: string | null;
  survey_skipped_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("WAITLIST_NOTIFY_DRAIN_SECRET")?.trim() ?? "";
  const got = req.headers.get("x-waitlist-notify-secret")?.trim() ?? "";
  if (!expected || got !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const notifyTo = Deno.env.get("WAITLIST_NOTIFY_EMAIL")?.trim() ?? "";

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!notifyTo || !EMAIL_RE.test(notifyTo)) {
    return new Response(JSON.stringify({ error: "WAITLIST_NOTIFY_EMAIL not set or invalid" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: due, error: qErr } = await admin
    .from("waitlist")
    .select(
      "id,email,locale,source,metadata,referral_code,referred_by,referred_by_code,admin_notify_at,signup_notify_deadline_at,survey_skipped_at",
    )
    .is("admin_notify_sent_at", null)
    .not("admin_notify_at", "is", null)
    .lte("admin_notify_at", nowIso)
    .order("admin_notify_at", { ascending: true })
    .limit(25);

  if (qErr) {
    return new Response(JSON.stringify({ error: "database_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (due ?? []) as WaitlistDueRow[];
  let sent = 0;
  let deferredAwaitingSurvey = 0;
  let failed = 0;

  const base = appPublicBase();

  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
    const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    const businessName = typeof meta.business_name === "string" ? meta.business_name.trim() : "";

    const { data: surveyRow } = await admin
      .from("waitlist_survey")
      .select(
        "groomer_count,tools_selected,tools_other,biggest_pain,wants_ath_movil,wants_costo,wants_nomina_pr,wants_staff_management,wants_spanish_ui,wants_online_booking,wants_charge_online,wants_inventory,wants_advanced_reports,current_tools",
      )
      .eq("waitlist_id", row.id)
      .maybeSingle();

    const deadlineMs = row.signup_notify_deadline_at
      ? new Date(row.signup_notify_deadline_at).getTime()
      : 0;
    const userSkipped = row.survey_skipped_at != null && String(row.survey_skipped_at).length > 0;
    const pastDeadline = deadlineMs > 0 && nowMs >= deadlineMs;
    const allowSendWithoutSurvey = Boolean(surveyRow) || userSkipped || pastDeadline;
    if (!allowSendWithoutSurvey) {
      deferredAwaitingSurvey += 1;
      continue;
    }

    const shareCode = typeof row.referral_code === "string" && row.referral_code.length > 0
      ? row.referral_code
      : "—";
    const usedCode =
      row.referred_by_code != null && String(row.referred_by_code).trim().length > 0
        ? String(row.referred_by_code)
        : "—";
    const sourceLabel = row.referred_by ? "referral" : row.source;

    const html = adminWaitlistNotifyHtml({
      appBase: base,
      fullName: fullName || "—",
      businessName: businessName || "—",
      email: row.email,
      locale: row.locale,
      sourceLabel,
      shareCode,
      usedCode,
      survey: surveyRow as Record<string, unknown> | null,
    });

    const mail = await sendResendEmail({
      to: notifyTo,
      subject: `New waitlist: ${row.email}`,
      html,
    });

    if (!mail.ok) {
      failed += 1;
      continue;
    }

    const { data: updated, error: markErr } = await admin
      .from("waitlist")
      .update({ admin_notify_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("admin_notify_sent_at", null)
      .select("id")
      .maybeSingle();

    if (!markErr && updated) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: rows.length,
      sent,
      deferredAwaitingSurvey,
      failed,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
