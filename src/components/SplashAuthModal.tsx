import { useEffect, useRef, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '@/lib/translations';

interface SplashAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  /** Optional center column (e.g. logo) between title and close — keeps title left-aligned. */
  headerCenter?: ReactNode;
  hideHeader?: boolean;
  panelClassName?: string;
  /** When `hideHeader` is true, styles for the floating close button (top-right). */
  closeButtonClassName?: string;
  children?: ReactNode;
}

export function SplashAuthModal({
  isOpen,
  onClose,
  title,
  titleId,
  headerCenter,
  hideHeader = false,
  panelClassName,
  closeButtonClassName,
  children,
}: SplashAuthModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-backdrop-blur-in bg-transparent"
      onClick={handleOverlayClick}
    >
      <div
        className={`relative z-[1000] w-[min(92vw,920px)] max-w-[920px] max-h-[min(92dvh,880px)] overflow-y-auto overscroll-y-contain rounded-3xl bg-white shadow-2xl animate-zoom-out-up ${panelClassName ?? ''}`}
        style={{
          boxShadow: '0 32px 64px rgba(0,0,0,0.24), 0 0 1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {hideHeader ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={`absolute right-3 top-3 z-[30] rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] ${closeButtonClassName ?? ''}`}
              aria-label={t('landing.modalClose')}
            >
              <X className="h-5 w-5" />
            </button>
          </>
        ) : headerCenter ? (
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-black/10 px-4 pb-4 pt-4 sm:gap-3 sm:px-6 sm:pb-6 sm:pt-6 md:mb-8 md:gap-4 md:px-12 md:pt-12">
            <h2
              id={titleId}
              className="min-w-0 justify-self-start pr-1 text-left text-base font-semibold text-foreground sm:pr-2 sm:text-lg md:text-xl"
            >
              {title}
            </h2>
            <div className="col-start-2 flex shrink-0 items-center justify-center px-1">{headerCenter}</div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="col-start-3 justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              aria-label={t('landing.modalClose')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between border-b border-black/10 px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6 md:mb-8 md:px-12 md:pt-12">
            <h2 id={titleId} className="text-lg font-semibold text-foreground sm:text-xl">
              {title}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00]"
              aria-label={t('landing.modalClose')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className={hideHeader ? 'px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6 md:px-12 md:pb-12 md:pt-12' : 'px-4 pb-4 sm:px-6 sm:pb-6 md:px-12 md:pb-12'}>
          {children}
        </div>
      </div>
    </div>
  );
}
