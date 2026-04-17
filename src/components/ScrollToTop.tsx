import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router does not reset window scroll on navigation. Without this, opening
 * e.g. /pricing from a long page (or mobile sheet) can leave the viewport scrolled
 * to a mid-page position. Hash links (/#features) still scroll to the target id.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
