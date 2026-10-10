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

/** Old page fades out briefly; new page content then reveals with a left-to-right, top-to-bottom stagger. */
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
      {/* Old page fades out quickly while leaving (no colored overlay), then the new page reveals. */}
      <div
        className={`${contentClass} page-transition-content print:min-h-0 print:overflow-visible`.trim()}
        data-active={dataActive}
        data-leaving={isCovering ? '' : undefined}
      >
        {children}
      </div>
    </div>
  );
}
