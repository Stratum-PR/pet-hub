/** Title-style name for kiosk / headers (words and hyphenated segments). */
export function toTitleCaseDisplayName(s: string): string {
  if (!s?.trim()) return s?.trim() ?? '';
  return s
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word
        .split('-')
        .map((seg) => (seg ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : seg))
        .join('-');
    })
    .join(' ');
}

/** Job title / free-text role line (groomer → Groomer, front_desk → Front Desk if underscores split). */
export function toTitleCaseJobTitle(role: string): string {
  const s = role?.trim() || '';
  if (!s) return '';
  return s
    .split(/[\s_/-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export type KioskLang = 'en' | 'es';

export function accessRoleKioskLabel(accessRole: string | null | undefined, lang: KioskLang): string {
  const r = (accessRole || 'staff').toLowerCase();
  const es = lang === 'es';
  if (r === 'manager') return es ? 'Gerente' : 'Manager';
  if (r === 'admin') return 'Admin';
  if (r === 'contractor') return es ? 'Contratista' : 'Contractor';
  return es ? 'Personal' : 'Staff';
}
