import { cn } from '@/lib/utils';
import { PawprintLoader, type PawprintLoaderSize } from '@/components/PawprintLoader';
import './PawStagedLoading.css';

/** Blur backdrop → paw fade-in; use with `leaving` for exit before unmount. */
export function PawStagedLoadingArea({
  label,
  size = 'lg',
  leaving = false,
  leavingTransition = 'default',
  className,
  compact = false,
}: {
  label: string;
  size?: PawprintLoaderSize;
  leaving?: boolean;
  /** `scaleReveal`: paw scales up + fades (dashboard handoff). */
  leavingTransition?: 'default' | 'scaleReveal';
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'paw-staged-root flex w-full flex-1 flex-col',
        leaving && 'paw-staged-leaving',
        leaving && leavingTransition === 'scaleReveal' && 'paw-staged-leaving-scale-reveal',
        className
      )}
    >
      <div className="paw-staged-backdrop" aria-hidden />
      <div className={cn('paw-staged-paw-wrap flex-1', compact && 'min-h-[200px]')}>
        <PawprintLoader compact={compact} size={size} label={label} showLabel={false} />
      </div>
    </div>
  );
}

/** Full-viewport staged loader (auth gates, settings shell). */
export function PawStagedLoadingFullscreen({
  label,
  zIndex = 50,
}: {
  label: string;
  zIndex?: number;
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col bg-background"
      style={{ zIndex }}
    >
      <PawStagedLoadingArea label={label} size="lg" className="ph-min-h-screen-safe flex-1" />
    </div>
  );
}
