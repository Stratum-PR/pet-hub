import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/translations';
import { canMarkAsNoShow } from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';

interface AppointmentNoShowControlProps {
  status: string | null | undefined;
  onMarkNoShow: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  /** Smaller padding for dense rows */
  compact?: boolean;
}

export function AppointmentNoShowControl({
  status,
  onMarkNoShow,
  disabled,
  className,
  compact,
}: AppointmentNoShowControlProps) {
  const [phase, setPhase] = useState<'idle' | 'confirm'>('idle');
  const [working, setWorking] = useState(false);

  if (!canMarkAsNoShow(status)) return null;

  const run = async () => {
    setWorking(true);
    try {
      await Promise.resolve(onMarkNoShow());
      setPhase('idle');
    } finally {
      setWorking(false);
    }
  };

  if (phase === 'confirm') {
    return (
      <span
        className={cn('inline-flex flex-wrap items-center gap-1', className)}
        data-no-nav
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="secondary"
          size={compact ? 'sm' : 'default'}
          className={cn('h-7 px-2 text-xs', compact && 'h-6')}
          disabled={disabled || working}
          onClick={() => void run()}
        >
          {t('appointments.noShowConfirm')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'default'}
          className={cn('h-7 px-2 text-xs', compact && 'h-6')}
          disabled={working}
          onClick={() => setPhase('idle')}
        >
          {t('common.cancel')}
        </Button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? 'sm' : 'sm'}
      className={cn('h-7 px-2 text-xs shrink-0', className)}
      disabled={disabled || working}
      data-no-nav
      onClick={(e) => {
        e.stopPropagation();
        setPhase('confirm');
      }}
    >
      {t('appointments.markNoShow')}
    </Button>
  );
}
