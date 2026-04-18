import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageTransition } from '@/contexts/PageTransitionContext';
import './PageTransition.css';

interface PageTransitionProps {
  children: React.ReactNode;
}

function suppressPageTransitionRevealStagger(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  return parts.includes('appt-book') || parts.includes('transactions') || parts.includes('time-kiosk');
}

/** Cover rolls down over old page (on top, z-index high). New page content reveals after with left-to-right, top-to-bottom stagger. */
export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation();
  const ctx = usePageTransition();
  const isCovering = ctx?.isCovering ?? false;
  const isRevealing = ctx?.isRevealing ?? false;
  const quietShell = suppressPageTransitionRevealStagger(pathname);
  const dataActive = isRevealing && !quietShell ? '' : undefined;

  const contentClass = useMemo(() => {
    return isRevealing && !quietShell ? 'page-transition-inner relative z-0 flex-1 min-h-0' : 'flex-1 min-h-0';
  }, [isRevealing, quietShell]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col print:min-h-0 print:h-auto print:overflow-visible">
      {/* Main content (old page while covering, new page after) — behind the cover when isCovering */}
      <div
        className={`${contentClass} print:min-h-0 print:overflow-visible`.trim()}
        data-active={dataActive}
      >
        {children}
      </div>
      {/* Cover: on TOP of main content so it visibly rolls down over current page; gives time for next page to load */}
      {isCovering && (
        <div
          // Use a subtle primary-tinted overlay so the transition feels intentional.
          className="absolute inset-0 top-0 z-20 h-0 min-h-0 bg-primary/15 animate-page-cover-down pointer-events-none"
          aria-hidden
        />
      )}
    </div>
  );
}
