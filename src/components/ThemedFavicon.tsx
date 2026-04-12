import { useEffect, useLayoutEffect } from 'react';
import { useTheme } from 'next-themes';
import { PET_HUB_THEME_APPLIED_EVENT } from '@/lib/businessThemeCss';
import { applyThemedPawFavicon } from '@/lib/themedFavicon';

/**
 * Keeps the tab favicon in sync with `--primary` (light/dark + business brand preview/save).
 */
export function ThemedFavicon() {
  const { resolvedTheme } = useTheme();

  useLayoutEffect(() => {
    applyThemedPawFavicon();
  }, [resolvedTheme]);

  useEffect(() => {
    const schedule = () => {
      requestAnimationFrame(() => applyThemedPawFavicon());
    };
    window.addEventListener(PET_HUB_THEME_APPLIED_EVENT, schedule);
    window.addEventListener('storage', schedule);
    return () => {
      window.removeEventListener(PET_HUB_THEME_APPLIED_EVENT, schedule);
      window.removeEventListener('storage', schedule);
    };
  }, []);

  return null;
}
