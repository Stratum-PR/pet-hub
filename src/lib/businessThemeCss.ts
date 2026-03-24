/**
 * Keeps `--primary` / `--secondary` in sync with business settings and caches them in sessionStorage
 * so the first paint of `PawStagedLoadingFullscreen` after refresh can match the account (not default olive).
 */

const THEME_CACHE_KEY = 'pet-hub-business-theme';

function normalizeCssHslTriplet(raw: string): string {
  return raw.replace(/hsl\(|\)/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Skips DOM writes when values already match computed vars — avoids repaints that restart
 * `currentColor` / loader animations on repeated apply (cache + fetch + Layout).
 */
export function applyPrimarySecondaryToDocument(primary: string, secondary: string) {
  const root = document.documentElement;
  const p = normalizeCssHslTriplet(primary);
  const s = normalizeCssHslTriplet(secondary);
  const cur = getComputedStyle(root);
  const curP = cur.getPropertyValue('--primary').trim().replace(/\s+/g, ' ');
  const curS = cur.getPropertyValue('--secondary').trim().replace(/\s+/g, ' ');
  if (curP === p && curS === s) return;
  root.style.setProperty('--primary', p);
  root.style.setProperty('--secondary', s);
}

export function readCachedBusinessTheme(businessId: string): { primary: string; secondary: string } | null {
  try {
    const raw = sessionStorage.getItem(`${THEME_CACHE_KEY}:${businessId}`);
    if (!raw) return null;
    const j = JSON.parse(raw) as { primary?: string; secondary?: string };
    if (j.primary && j.secondary) return { primary: j.primary, secondary: j.secondary };
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCachedBusinessTheme(businessId: string, primary: string, secondary: string) {
  try {
    sessionStorage.setItem(
      `${THEME_CACHE_KEY}:${businessId}`,
      JSON.stringify({ primary, secondary })
    );
  } catch {
    /* ignore */
  }
}
