import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';

type PastBookingConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
};

/**
 * Themed confirmation for backdated appointments (replaces browser confirm()).
 */
export function PastBookingConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: PastBookingConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          'max-w-[min(calc(100vw-2rem),20rem)] gap-3 rounded-2xl border-2 border-border bg-card p-4 text-card-foreground shadow-lg',
          'dark:bg-card',
        )}
      >
        <AlertDialogHeader className="space-y-2 text-left">
          <AlertDialogTitle className="text-base font-semibold leading-snug">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <AlertDialogCancel className="mt-0 h-9 border-2 border-border bg-background px-3 text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-9 px-3 text-sm"
            onClick={() => {
              onConfirm();
            }}
          >
            {t('common.continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
