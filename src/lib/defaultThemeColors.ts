/**
 * Default brand palette for new businesses, demo (no saved prefs), and Account Settings fallbacks.
 *
 * Primary — olive from paw mark: the loader SVG uses `fill-current` / `text-primary`, matching
 * `index.css` :root. Approximate sRGB: **#6B8B70** (muted sage-olive).
 * HSL: hue ~127°, low saturation for an earthy (not neon) green.
 */
export const DEFAULT_PRIMARY_COLOR_HSL = '127 18% 47%';

/**
 * Secondary — warm clay / terracotta (muted, not neon) for `secondary` surfaces.
 * Deliberately darker than page bg (~90% L) so it never reads as “empty” or transparent.
 * Pairs with olive; works with default `--secondary-foreground` (dark text).
 * Approximate sRGB: **#D3B39C**.
 */
export const DEFAULT_SECONDARY_COLOR_HSL = '25 38% 72%';

/** Preset hex for theme picker / docs (derived from HSL above). */
export const DEFAULT_PRIMARY_HEX = '#6B8B70';
export const DEFAULT_SECONDARY_HEX = '#D3B39C';
