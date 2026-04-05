/**
 * Curated IANA timezones for business settings (searchable picker, not full TZ database).
 * Current business timezone is always merged in when missing.
 */

const CURATED_IANA_TIMEZONES = [
  'Pacific/Midway',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Caracas',
  'America/Puerto_Rico',
  'America/Halifax',
  'America/Santo_Domingo',
  'America/Havana',
  'America/Bogota',
  'America/Lima',
  'America/Panama',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Guatemala',
  'America/El_Salvador',
  'America/Managua',
  'America/Costa_Rica',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'Atlantic/Azores',
  'Atlantic/Cape_Verde',
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Athens',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Manila',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Fiji',
] as const;

function ianaCityLabel(iana: string): string {
  const parts = iana.split('/');
  const last = parts[parts.length - 1] || iana;
  return last.replace(/_/g, ' ');
}

/** Parse GMT±H[:MM] from Intl shortOffset (e.g. GMT-4, GMT+5:30). */
function parseGmtOffsetToMinutes(shortOffset: string): number {
  const m = shortOffset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h * 60 + min);
}

function shortOffsetForZone(timeZone: string, at: Date): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

export interface TimezonePickerOption {
  iana: string;
  label: string;
  searchText: string;
  offsetMinutes: number;
}

/**
 * Build sorted picker options (by offset, then city). Merges `currentIana` if not in curated list.
 */
export function buildTimezonePickerOptions(currentIana: string | undefined | null): TimezonePickerOption[] {
  const at = new Date();
  const set = new Set<string>([...CURATED_IANA_TIMEZONES]);
  const trimmed = (currentIana || '').trim();
  if (trimmed) set.add(trimmed);

  const options: TimezonePickerOption[] = [];
  for (const iana of set) {
    const offsetStr = shortOffsetForZone(iana, at);
    const offsetMinutes = parseGmtOffsetToMinutes(offsetStr);
    const city = ianaCityLabel(iana);
    const label = offsetStr ? `${city} (${offsetStr})` : city;
    const searchText = `${iana} ${city} ${offsetStr}`.toLowerCase();
    options.push({ iana, label, searchText, offsetMinutes });
  }

  options.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });

  return options;
}
