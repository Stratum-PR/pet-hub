/**
 * Sends due internal waitlist notifications (Resend). Invoke on a schedule (e.g. every minute)
 * with header x-waitlist-notify-secret matching WAITLIST_NOTIFY_DRAIN_SECRET.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

/** HTML escape + templates (single-file deploy; banner/esc mirror waitlist-signup). */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

const ADMIN_TOOL_LABEL: Record<string, string> = {
  "pen-paper": "Pen & paper",
  spreadsheet: "Spreadsheet",
  software: "Other software",
  other: "Other",
};

const ADMIN_GROOMER_LABEL: Record<string, string> = {
  "1": "1 groomer",
  "2-5": "2–5 groomers",
  "6-9": "6–9 groomers",
  "10+": "10+ groomers",
};

function adminSurveyAnswersHtml(survey: Record<string, unknown> | null): string {
  if (!survey) {
    return `<p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0;">This user has not submitted the optional survey yet.</p>`;
  }
  const rows: string[] = [];
  const gc = typeof survey.groomer_count === "string" ? survey.groomer_count : "";
  if (gc) {
    rows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;width:160px;">Team size</td><td style="padding:6px 0;color:#111827;">${esc(ADMIN_GROOMER_LABEL[gc] ?? gc)}</td></tr>`,
    );
  }
  const toolsRaw = survey.tools_selected;
  if (Array.isArray(toolsRaw) && toolsRaw.length > 0) {
    const labels = toolsRaw
      .filter((x): x is string => typeof x === "string")
      .map((k) => ADMIN_TOOL_LABEL[k.trim()] ?? k.trim());
    if (labels.length > 0) {
      rows.push(
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;">Tools today</td><td style="padding:6px 0;color:#111827;">${esc(labels.join(", "))}</td></tr>`,
      );
    }
  }
  const toolsOther = typeof survey.tools_other === "string" && survey.tools_other.trim()
    ? survey.tools_other.trim()
    : "";
  if (toolsOther) {
    rows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;">Other tools detail</td><td style="padding:6px 0;color:#111827;">${esc(toolsOther)}</td></tr>`,
    );
  }
  const legacyTools = typeof survey.current_tools === "string" && survey.current_tools.trim()
    ? survey.current_tools.trim()
    : "";
  if (legacyTools) {
    rows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;">Current tools (legacy)</td><td style="padding:6px 0;color:#111827;">${esc(legacyTools)}</td></tr>`,
    );
  }
  const pain = typeof survey.biggest_pain === "string" && survey.biggest_pain.trim()
    ? survey.biggest_pain.trim()
    : "";
  if (pain) {
    rows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;">Biggest pain</td><td style="padding:6px 0;color:#111827;">${esc(pain)}</td></tr>`,
    );
  }
  const wants: [string, unknown][] = [
    ["ATH Móvil / payments", survey.wants_ath_movil],
    ["Cost / COGS tracking", survey.wants_costo],
    ["Puerto Rico payroll", survey.wants_nomina_pr],
    ["Staff management", survey.wants_staff_management],
    ["Spanish UI", survey.wants_spanish_ui],
    ["Online booking", survey.wants_online_booking],
    ["Charge clients online", survey.wants_charge_online],
    ["Inventory", survey.wants_inventory],
    ["Advanced reports", survey.wants_advanced_reports],
  ];
  const yes = wants.filter(([, v]) => v === true).map(([label]) => label);
  if (yes.length > 0) {
    rows.push(
      `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;">Feature interest</td><td style="padding:6px 0;color:#111827;">${esc(yes.join(", "))}</td></tr>`,
    );
  }
  if (rows.length === 0) {
    return `<p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0;">This user has not submitted the optional survey yet.</p>`;
  }
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0;">${rows.join("")}</table>`;
}

function adminWaitlistNotifyHtml(params: {
  appBase: string;
  fullName: string;
  businessName: string;
  email: string;
  locale: string;
  sourceLabel: string;
  shareCode: string;
  usedCode: string;
  survey: Record<string, unknown> | null;
}): string {
  const surveyBlock = adminSurveyAnswersHtml(params.survey);
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
  ${grumiEmailBanner(params.appBase)}
  <p style="font-weight:700;color:#0f1923;margin:0 0 16px;font-size:18px;">New Grumi waitlist signup</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Name:</strong> ${esc(params.fullName)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Business:</strong> ${esc(params.businessName)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Email:</strong> ${esc(params.email)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Locale:</strong> ${esc(params.locale)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Source:</strong> ${esc(params.sourceLabel)}</p>
  <p style="color:#374151;margin:0 0 8px;"><strong>Referral code they share:</strong> ${esc(params.shareCode)}</p>
  <p style="color:#374151;margin:0 0 20px;"><strong>Referral code used at signup:</strong> ${esc(params.usedCode)}</p>
  <p style="font-weight:700;color:#0f1923;margin:0 0 10px;font-size:15px;">Optional survey</p>
  ${surveyBlock}
</div>`;
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
