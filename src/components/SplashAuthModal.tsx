import { useEffect, useRef, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '@/lib/translations';

interface SplashAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children?: ReactNode;
}

export function SplashAuthModal({ isOpen, onClose, title, titleId, children }: SplashAuthModalProps) {
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
        className="relative z-[1000] w-[90vw] max-w-[920px] max-h-[85vh] overflow-y-auto rounded-3xl bg-white shadow-2xl animate-modal-appear"
        style={{
          boxShadow: '0 32px 64px rgba(0,0,0,0.24), 0 0 1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 pb-6 mb-8 px-6 pt-6 md:px-12 md:pt-12">
          <h2 id={titleId} className="text-xl font-semibold text-foreground">
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
        <div className="px-6 pb-6 md:px-12 md:pb-12">{children}</div>
      </div>
    </div>
  );
}
