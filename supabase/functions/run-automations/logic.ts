// Pure helpers for run-automations (no Deno/Supabase imports, so they're unit-tested with Vitest).

export const DEFAULT_TIMEZONE = "America/Puerto_Rico";

/** Days after the birthday the daily run may still send it (covers a missed day). */
export const EXACT_DAY_CATCH_UP_DAYS = 2;
/** Pets with only a birth month get the email in the first days of that month. */
export const MONTH_ONLY_SEND_UNTIL_DAY = 7;

export type Ymd = { year: number; month: number; day: number };

export function todayInZone(now: Date, timeZone: string | null | undefined): Ymd {
  let tz = timeZone?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = DEFAULT_TIMEZONE;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type PetBirth = { birth_month: number | null; birth_day: number | null };

/**
 * Should today's run send the birthday email for this pet?
 * - With a birth day: on that day, or up to EXACT_DAY_CATCH_UP_DAYS later if a run was missed
 *   (Feb 29 and other days past the month's end fall on the month's last day).
 * - Month only: during the first MONTH_ONLY_SEND_UNTIL_DAY days of the birth month.
 * Sending once per year is enforced separately by the run log.
 */
export function birthdayDueToday(pet: PetBirth, today: Ymd): boolean {
  if (!pet.birth_month || pet.birth_month !== today.month) return false;
  if (pet.birth_day) {
    const day = Math.min(pet.birth_day, daysInMonth(today.year, today.month));
    return today.day >= day && today.day <= day + EXACT_DAY_CATCH_UP_DAYS;
  }
  return today.day <= MONTH_ONLY_SEND_UNTIL_DAY;
}

export type TemplateValues = {
  pet_name: string;
  owner_first_name: string;
  owner_name: string;
  business_name: string;
  pet_age: string;
};

export const PLACEHOLDERS: (keyof TemplateValues)[] = [
  "pet_name",
  "owner_first_name",
  "owner_name",
  "business_name",
  "pet_age",
];

/** Replaces {{placeholder}} tokens (unknown tokens are left as typed). */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key as keyof TemplateValues] : match
  );
}

export function petAge(birthYear: number | null | undefined, todayYear: number): string {
  if (!birthYear || !Number.isFinite(birthYear) || birthYear > todayYear) return "";
  return String(todayYear - birthYear);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/** Plain-text body -> simple branded HTML (paragraphs, line breaks), everything escaped. */
export function bodyToHtml(body: string, businessName: string, footer: string): string {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f0;font-family:Arial,Helvetica,sans-serif;color:#1f2a1f">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:12px;padding:28px;font-size:16px;line-height:1.5">${paragraphs}</div>
<p style="font-size:12px;color:#6b7280;margin:16px 4px 0">${escapeHtml(footer)}</p>
<p style="font-size:12px;color:#9ca3af;margin:4px">${escapeHtml(businessName)} · Grumi</p>
</div></body></html>`;
}

/** Display name safe for a From header. */
export function senderName(businessName: string): string {
  const clean = businessName.replace(/["<>\r\n]/g, "").trim().slice(0, 60);
  return clean || "Grumi";
}
