import { useRef, useLayoutEffect } from 'react';

/**
 * Attach ref to page root. After mount, sets data-page-visible so CSS can run
 * the page-load sequence (title → subtitle → toolbar → search → table/content).
 */
export function usePageLoadRef() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.setAttribute('data-page-visible', '');
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return ref;
}
