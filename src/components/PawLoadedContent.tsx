import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { PawStagedLoadingArea } from '@/components/PawStagedLoading';
import { PawRevealEnter } from '@/components/PawRevealEnter';
import { PAW_STAGED_EXIT_UNMOUNT_MS } from '@/lib/dashboardEnterAnimation';
import type { PawprintLoaderSize } from '@/components/PawprintLoader';

/** Matches pawprint CSS loop (main + toes): 0.72s */
const PAW_CYCLE_MS = 720;

/** Must allow staged paw exit CSS to finish; see dashboardEnterAnimation.ts */
const EXIT_MS = PAW_STAGED_EXIT_UNMOUNT_MS;

type LeavingTransition = 'default' | 'scaleReveal';

/**
 * Staged loader (blur → paw), then children with optional blur-to-sharp reveal.
 *
 * **Content visibility**
 * - Mount when overlay **starts leaving** (`overlayLeaving`) so enter animations run under the fading paw.
 *
 * **`viewportCover`**
 * - Portals the overlay to `document.body` at high z-index so the paw stays **full viewport** over
 *   sidebar + header until data is ready.
 */
export function PawLoadedContent({
  loading,
  loaderLabel,
  loaderSize = 'lg',
  className,
  loaderWrapperClassName,
  reveal = true,
  viewportCover = false,
  leavingTransition = 'default',
  children,
}: {
  loading: boolean;
  loaderLabel: string;
  loaderSize?: PawprintLoaderSize;
  className?: string;
  loaderWrapperClassName?: string;
  reveal?: boolean;
  viewportCover?: boolean;
  leavingTransition?: LeavingTransition;
  children: React.ReactNode;
}) {
  const [overlayMounted, setOverlayMounted] = useState(loading);
  const [overlayLeaving, setOverlayLeaving] = useState(false);
  const cycleStartRef = useRef<number | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current);
        unmountTimeoutRef.current = null;
      }
      setOverlayLeaving(false);
      setOverlayMounted(true);
      cycleStartRef.current = performance.now();
      return;
    }

    if (!overlayMounted) return;

    const start = cycleStartRef.current ?? performance.now();
    const elapsed = performance.now() - start;
    const rem = elapsed % PAW_CYCLE_MS;
    const waitMs = rem < 1 ? 0 : PAW_CYCLE_MS - rem;

    leaveTimeoutRef.current = setTimeout(() => {
      leaveTimeoutRef.current = null;
      setOverlayLeaving(true);
      unmountTimeoutRef.current = setTimeout(() => {
        unmountTimeoutRef.current = null;
        setOverlayMounted(false);
        setOverlayLeaving(false);
        cycleStartRef.current = null;
      }, EXIT_MS);
    }, waitMs);

    return () => {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    };
  }, [loading, overlayMounted]);

  const contentClassName = cn('relative z-0 flex min-h-0 min-w-0 flex-1 flex-col', className);

  const contentVisible =
    !loading && (overlayLeaving || !overlayMounted);

  const areaProps = {
    label: loaderLabel,
    size: loaderSize,
    leaving: overlayLeaving,
    leavingTransition,
    compact: false as const,
  };

  const viewportOverlay =
    overlayMounted && viewportCover && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[10050] flex min-h-[100dvh] w-full flex-col bg-background"
            style={{ pointerEvents: loading ? 'auto' : 'none' }}
            aria-busy={loading}
            aria-label={loaderLabel}
          >
            <PawStagedLoadingArea {...areaProps} className="min-h-[100dvh] flex-1" />
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn('relative flex min-w-0 flex-1 flex-col', contentVisible && 'min-h-0')}>
      {contentVisible &&
        (reveal ? (
          <PawRevealEnter className={contentClassName}>{children}</PawRevealEnter>
        ) : (
          <div className={contentClassName}>{children}</div>
        ))}
      {viewportOverlay}
      {overlayMounted && !viewportCover && (
        <div
          className={cn(
            'flex flex-1 flex-col',
            loading
              ? cn('min-h-[max(70vh,calc(100dvh-10rem))]', loaderWrapperClassName)
              : 'pointer-events-none absolute inset-0 z-10 min-h-0'
          )}
        >
          <PawStagedLoadingArea {...areaProps} className="flex-1" />
        </div>
      )}
    </div>
  );
}
