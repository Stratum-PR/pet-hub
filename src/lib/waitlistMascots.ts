/** Only Kayro is used on the waitlist join modal (preload + random pick). */
export const WAITLIST_MASCOT_SRCS = ['/waitlist-mascots/kayro.webp'] as const;

/**
 * Corner mascots on marketing feature screenshots (waitlist modal uses `WAITLIST_MASCOT_SRCS` only).
 * Indices: 0 basset, 1 gray cat, 2 Kayro, 3 leo — assigned per card in `FeaturesMarketingSection`.
 */
export const FEATURE_HIGHLIGHT_MASCOT_SRCS = [
  '/waitlist-mascots/basset-hound.webp',
  '/waitlist-mascots/gray-cat.webp',
  '/waitlist-mascots/kayro.webp',
  '/waitlist-mascots/leo.webp',
] as const;

export function pickRandomWaitlistMascotSrc(): (typeof WAITLIST_MASCOT_SRCS)[number] {
  const i = Math.floor(Math.random() * WAITLIST_MASCOT_SRCS.length);
  return WAITLIST_MASCOT_SRCS[i];
}

/** Decode image into browser cache; resolves on load or on error (do not block UX). */
export function preloadImageSrc(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function preloadAllWaitlistMascots(): Promise<void> {
  return Promise.all(WAITLIST_MASCOT_SRCS.map((src) => preloadImageSrc(src))).then(() => undefined);
}
