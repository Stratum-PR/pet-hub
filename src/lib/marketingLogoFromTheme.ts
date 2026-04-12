import { BRANDING_THEME_PRESETS } from '@/lib/brandingThemePresets';
import { DOC_THEME_STORAGE_KEY } from '@/lib/businessThemeCss';
import { hexToHsl } from '@/lib/colorFormat';
import { DEFAULT_PRIMARY_COLOR_HSL, DEFAULT_SECONDARY_COLOR_HSL } from '@/lib/defaultThemeColors';

/** Public folder wordmarks keyed by preset `id` from `BRANDING_THEME_PRESETS`. */
const LOGO_SRC_BY_PRESET_ID: Record<string, string> = {
  'pet-hub': '/logo_grumi_theme.png',
  ocean: '/logo_ocean_theme.png',
  forest: '/logo_forest_theme.png',
  sunset: '/logo_sunset_theme.png',
  midnight: '/logo_midnight_theme.png',
  lavender: '/logo_lavender_theme.png',
  slate: '/logo_slate_theme.png',
};

/** Default public wordmark when colors do not match a preset (also invoice/OG fallbacks). */
export const DEFAULT_GRUMI_WORDMARK_SRC = '/logo_grumi_theme.png';

const DEFAULT_LOGO = DEFAULT_GRUMI_WORDMARK_SRC;

function normalizeHslTriplet(raw: string): string {
  return raw.replace(/hsl\(|\)/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Pick the marketing nav logo that matches the current primary/secondary HSL triplets
 * (same encoding as `--primary` / `--secondary` on `document.documentElement`).
 */
export function resolveMarketingLogoFromPrimarySecondary(primary: string, secondary: string): string {
  const p = normalizeHslTriplet(primary);
  const s = normalizeHslTriplet(secondary);
  for (const preset of BRANDING_THEME_PRESETS) {
    const pp = normalizeHslTriplet(hexToHsl(preset.primary));
    const ss = normalizeHslTriplet(hexToHsl(preset.secondary));
    if (p === pp && s === ss) {
      return LOGO_SRC_BY_PRESET_ID[preset.id] ?? DEFAULT_LOGO;
    }
  }
  return DEFAULT_LOGO;
}

function readStoredDocTheme(): { primary: string; secondary: string } | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DOC_THEME_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { primary?: string; secondary?: string };
    if (j.primary && j.secondary) {
      return { primary: normalizeHslTriplet(j.primary), secondary: normalizeHslTriplet(j.secondary) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Active brand colors: computed CSS vars first, then last-applied snapshot from sessionStorage, then defaults. */
export function getActiveThemePrimarySecondary(): { primary: string; secondary: string } {
  if (typeof document === 'undefined') {
    return { primary: DEFAULT_PRIMARY_COLOR_HSL, secondary: DEFAULT_SECONDARY_COLOR_HSL };
  }
  const cur = getComputedStyle(document.documentElement);
  let p = cur.getPropertyValue('--primary').trim().replace(/\s+/g, ' ');
  let s = cur.getPropertyValue('--secondary').trim().replace(/\s+/g, ' ');
  if (!p || !s) {
    const stored = readStoredDocTheme();
    if (stored) {
      p = stored.primary;
      s = stored.secondary;
    }
  }
  if (!p || !s) {
    return {
      primary: normalizeHslTriplet(DEFAULT_PRIMARY_COLOR_HSL),
      secondary: normalizeHslTriplet(DEFAULT_SECONDARY_COLOR_HSL),
    };
  }
  return { primary: p, secondary: s };
}

export function getMarketingLogoSrc(): string {
  const { primary, secondary } = getActiveThemePrimarySecondary();
  return resolveMarketingLogoFromPrimarySecondary(primary, secondary);
}
