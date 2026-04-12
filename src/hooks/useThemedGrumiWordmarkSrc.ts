import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PET_HUB_THEME_APPLIED_EVENT } from '@/lib/businessThemeCss';
import { getMarketingLogoSrc } from '@/lib/marketingLogoFromTheme';

type Options = {
  /** When true, re-read theme-derived logo on pathname changes (marketing routes, etc.). */
  refreshOnPathname?: boolean;
};

/**
 * Public Grumi wordmark image URL derived from current `--primary` / `--secondary`
 * (including Business Settings preview via session snapshot + `pet-hub-theme-applied`).
 */
export function useThemedGrumiWordmarkSrc(options: Options = {}) {
  const { refreshOnPathname = true } = options;
  const location = useLocation();
  const [src, setSrc] = useState(() => getMarketingLogoSrc());

  const refresh = useCallback(() => {
    setSrc(getMarketingLogoSrc());
  }, []);

  useLayoutEffect(() => {
    if (!refreshOnPathname) return;
    refresh();
  }, [refresh, refreshOnPathname, location.pathname]);

  useEffect(() => {
    const onThemeApplied = () => refresh();
    window.addEventListener(PET_HUB_THEME_APPLIED_EVENT, onThemeApplied);
    window.addEventListener('storage', onThemeApplied);
    return () => {
      window.removeEventListener(PET_HUB_THEME_APPLIED_EVENT, onThemeApplied);
      window.removeEventListener('storage', onThemeApplied);
    };
  }, [refresh]);

  return src;
}
