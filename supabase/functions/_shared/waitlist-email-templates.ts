/** Shared HTML fragments for waitlist Resend emails (Edge Functions). */

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Centered Grumi logo + wordmark for HTML emails (absolute asset URL). */
export function grumiEmailBanner(base: string): string {
  const logo = `${base}/logo_grumi_theme.png`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
  <tr>
    <td align="center" style="padding:8px 0 0;">
      <img src="${logo}" width="132" alt="Grumi" style="display:block;max-width:140px;height:auto;border:0;margin:0 auto;" />
      <p style="font-size:20px;font-weight:700;color:#0f1923;margin:12px 0 0;letter-spacing:-0.02em;">Grumi</p>
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

/** Internal notification: optional survey summary (English). */
export function adminSurveyAnswersHtml(survey: Record<string, unknown> | null): string {
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

export function adminWaitlistNotifyHtml(params: {
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
