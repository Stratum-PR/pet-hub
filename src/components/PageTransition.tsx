import { useMemo } from 'react';
import { usePageTransition } from '@/contexts/PageTransitionContext';
import './PageTransition.css';

interface PageTransitionProps {
  children: React.ReactNode;
}

/** Cover rolls down over old page (on top, z-index high). New page content reveals after with left-to-right, top-to-bottom stagger. */
export function PageTransition({ children }: PageTransitionProps) {
  const ctx = usePageTransition();
  const isCovering = ctx?.isCovering ?? false;
  const isRevealing = ctx?.isRevealing ?? false;
  const dataActive = isRevealing ? '' : undefined;

  const contentClass = useMemo(() => {
    return isRevealing ? 'page-transition-inner relative z-0 flex-1 min-h-0' : 'flex-1 min-h-0';
  }, [isRevealing]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Main content (old page while covering, new page after) — behind the cover when isCovering */}
      <div className={contentClass} data-active={dataActive}>
        {children}
      </div>
      {/* Cover: on TOP of main content so it visibly rolls down over current page; gives time for next page to load */}
      {isCovering && (
        <div
          className="absolute inset-0 top-0 z-20 h-0 min-h-0 bg-background animate-page-cover-down pointer-events-none"
          aria-hidden
        />
      )}
    </div>
  );
}
