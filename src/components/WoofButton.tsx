import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import './WoofButton.css';

const WOOF_ANIM_PHASE_MS = 800;
const WOOF_COOLDOWN_MS = 5_000;

type WoofPhase = 'idle' | 'animating' | 'cooldown';

export function WoofButton({ onWoof }: { onWoof: () => void }) {
  const [phase, setPhase] = useState<WoofPhase>('idle');
  const animEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const busy = phase !== 'idle';

  const clearTimers = useCallback(() => {
    if (animEndRef.current) {
      clearTimeout(animEndRef.current);
      animEndRef.current = null;
    }
    if (cooldownEndRef.current) {
      clearTimeout(cooldownEndRef.current);
      cooldownEndRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleClick = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('animating');
    onWoof();

    animEndRef.current = setTimeout(() => {
      animEndRef.current = null;
      setPhase('cooldown');
    }, WOOF_ANIM_PHASE_MS);

    cooldownEndRef.current = setTimeout(() => {
      cooldownEndRef.current = null;
      setPhase('idle');
    }, WOOF_ANIM_PHASE_MS + WOOF_COOLDOWN_MS);
  }, [onWoof, phase]);

  const outerClass = cn(
    'woof-btn-outer',
    phase === 'animating' && 'woof-btn-outer--animating woof-btn-outer--ring-active',
    phase === 'cooldown' && 'woof-btn-outer--cooldown'
  );

  const button = (
    <div className={outerClass}>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="woof-btn-face"
        title={
          phase === 'cooldown'
            ? t('layout.woofCooldownTooltip')
            : phase === 'animating'
              ? undefined
              : t('layout.woofButton')
        }
        aria-busy={busy}
      >
        <Sparkles className="woof-sparkle-icon" strokeWidth={2} aria-hidden />
        <span>{t('layout.woofButton')}</span>
      </button>
    </div>
  );

  if (phase === 'cooldown') {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="inline-flex rounded-full cursor-not-allowed">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {t('layout.woofCooldownTooltip')}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
