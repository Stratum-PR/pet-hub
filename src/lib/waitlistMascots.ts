export const WAITLIST_MASCOT_SRCS = ['/waitlist-mascots/kayro.webp'] as const;

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
