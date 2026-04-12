import { hexToHsl } from '@/lib/colorFormat';
import { PET_PAW_G_TRANSFORM, PET_PAW_PATHS, PET_PAW_VIEWBOX } from '@/lib/petPawGeometry';

/** Forest theme primary (`BRANDING_THEME_PRESETS` id `forest`) — default paw before `--primary` is readable. */
const FOREST_PRIMARY_HEX = '#2D6A4F';

/** Fallback when `--primary` is not yet on `:root` (SSR / first paint). */
const DEFAULT_PRIMARY_TRIPLET = hexToHsl(FOREST_PRIMARY_HEX);

function readPrimaryTripletFromDocument(): string {
  if (typeof document === 'undefined') return DEFAULT_PRIMARY_TRIPLET;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  if (!raw) return DEFAULT_PRIMARY_TRIPLET;
  return raw.replace(/\s+/g, ' ');
}

/**
 * SVG favicon data URL: same paw geometry as `PawprintLoader` / `pet-paw.svg`, fill = `hsl(var(--primary))`.
 */
export function buildThemedPawFaviconDataUrl(primaryTriplet?: string): string {
  const triplet = (primaryTriplet ?? readPrimaryTripletFromDocument()).trim();
  const fill = `hsl(${triplet})`;
  const { toe1, toe2, toe3, toe4, main } = PET_PAW_PATHS;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PET_PAW_VIEWBOX}"><g transform="${PET_PAW_G_TRANSFORM}"><path fill="${fill}" d="${toe1}"/><path fill="${fill}" d="${toe2}"/><path fill="${fill}" d="${toe3}"/><path fill="${fill}" d="${toe4}"/><path fill="${fill}" d="${main}"/></g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Updates `<link rel="icon">` to the paw tinted with the active `--primary`. */
export function applyThemedPawFavicon(): void {
  if (typeof document === 'undefined') return;
  const href = buildThemedPawFaviconDataUrl();
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = href;
}
