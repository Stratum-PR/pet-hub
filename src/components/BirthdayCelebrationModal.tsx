import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { t } from '@/lib/translations';

const CELEBRATION_MS = 5000;
const TICK_MS = 250;

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function runFireworksConfetti(durationMs: number) {
  const animationEnd = Date.now() + durationMs;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }
    const particleCount = Math.floor((50 * timeLeft) / durationMs);
    void confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    void confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, TICK_MS);

  return () => clearInterval(interval);
}

type BirthdayCelebrationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  businessName: string;
};

export function BirthdayCelebrationModal({
  open,
  onOpenChange,
  firstName,
  businessName,
}: BirthdayCelebrationModalProps) {
  const stopRef = useRef<(() => void) | null>(null);

  const celebrateAgain = useCallback(() => {
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    stopRef.current = runFireworksConfetti(CELEBRATION_MS);
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 bg-gradient-to-br from-violet-600/95 via-fuchsia-600/90 to-amber-500/85 text-white shadow-2xl sm:max-w-md">
        <DialogHeader className="space-y-3 text-center sm:text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <PartyPopper className="h-8 w-8" aria-hidden />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white">
            {t('birthdayModal.title', { name: firstName })}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-white/90">
            {t('birthdayModal.body')}
          </DialogDescription>
          <p className="text-sm font-medium text-white/85">{t('birthdayModal.fromTeam', { company: businessName })}</p>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="secondary"
            className="w-full bg-white/95 text-violet-900 hover:bg-white"
            onClick={celebrateAgain}
          >
            {t('birthdayModal.celebrateAgain')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
