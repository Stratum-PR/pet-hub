import { createContext, useContext, useRef, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const COVER_DURATION_MS = 1200;

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

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
      }, 3600);
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
