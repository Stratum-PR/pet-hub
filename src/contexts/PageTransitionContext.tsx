import { createContext, useContext, useRef, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Keep transitions fast so users perceive navigation as intentional (not a "glitch").
// Note: cover animation duration is also defined in tailwind.config.ts (page-cover-down).
const COVER_DURATION_MS = 500;
const REVEAL_DURATION_MS = 900;

/** Last URL segment `dashboard`. */
function isDashboardAppPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 0 && parts[parts.length - 1] === 'dashboard';
}

/**
 * `/{businessSlug}` only — Index immediately `<Navigate to="dashboard" />` here. Treat like dashboard so we
 * do not run the 900ms initial reveal on the slug URL and again after the redirect.
 */
function isBusinessRootPath(pathname: string): boolean {
  return pathname.split('/').filter(Boolean).length === 1;
}

function skipGlobalPageTransitionForPath(pathname: string): boolean {
  return isDashboardAppPath(pathname) || isBusinessRootPath(pathname);
}

type PageTransitionContextValue = {
  /** Real pathname from router (updates immediately on navigation) */
  pathname: string;
  /** Pathname used for rendering route content (lags until cover finishes, so old page stays visible) */
  displayPathname: string;
  /** True while the cover is rolling down over the old page */
  isCovering: boolean;
  /** True after cover ends and we're revealing the new page (title + containers) */
  isRevealing: boolean;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) return null;
  return ctx;
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const [displayPathname, setDisplayPathname] = useState(pathname);
  const [isCovering, setIsCovering] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const prevPathRef = useRef(pathname);
  const initialMountRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      if (!skipGlobalPageTransitionForPath(pathname)) {
        setIsRevealing(true);
        revealTimeoutRef.current = setTimeout(() => {
          revealTimeoutRef.current = null;
          setIsRevealing(false);
        }, REVEAL_DURATION_MS);
      }
      return () => {
        if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      };
    }

    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    if (skipGlobalPageTransitionForPath(pathname)) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      timeoutRef.current = null;
      revealTimeoutRef.current = null;
      setDisplayPathname(pathname);
      setIsCovering(false);
      setIsRevealing(false);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      };
    }

    setIsCovering(true);
    setIsRevealing(false);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setDisplayPathname(pathname);
      setIsCovering(false);
      setIsRevealing(true);
      revealTimeoutRef.current = setTimeout(() => {
        revealTimeoutRef.current = null;
        setIsRevealing(false);
      }, REVEAL_DURATION_MS);
    }, COVER_DURATION_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [pathname]);

  // Sync displayPathname if we're not transitioning (e.g. initial load or refresh)
  useEffect(() => {
    if (!isCovering && pathname === displayPathname) {
      prevPathRef.current = pathname;
    }
  }, [pathname, displayPathname, isCovering]);

  const value: PageTransitionContextValue = {
    pathname,
    displayPathname,
    isCovering,
    isRevealing,
  };

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
    </PageTransitionContext.Provider>
  );
}
