import { Edit, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type DetailModalActionBarProps = {
  className?: string;
  /** Use on `bg-primary` heroes so controls stay readable. */
  tone?: 'default' | 'on-primary';
  /** Edit + delete (default). */
  variant?: 'edit-delete' | 'save-delete';
  onEdit?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onAux?: () => void;
  /** When set with variant save-delete, Save is type="submit" for this form id (no onSave). */
  submitFormId?: string;
  editLabel?: string;
  deleteLabel?: string;
  saveLabel?: string;
  auxLabel?: string;
  auxIcon?: ReactNode;
  auxVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  disabledEdit?: boolean;
  disabledDelete?: boolean;
  disabledSave?: boolean;
  disabledAux?: boolean;
};

/**
 * Top-of-modal actions: consistent outline Edit (or primary Save) + destructive Delete.
 * Leave room for the dialog close (X) via `pr-10` on the parent or this bar.
 */
export function DetailModalActionBar({
  className,
  tone = 'default',
  variant = 'edit-delete',
  onEdit,
  onDelete,
  onSave,
  onAux,
  submitFormId,
  editLabel,
  deleteLabel,
  saveLabel,
  auxLabel,
  auxIcon,
  auxVariant = 'outline',
  disabledEdit,
  disabledDelete,
  disabledSave,
  disabledAux,
}: DetailModalActionBarProps) {
  const onPrimary = tone === 'on-primary';
  const outlineMuted = onPrimary
    ? 'h-9 gap-1.5 border-primary-foreground/35 bg-primary-foreground/10 px-3 text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/20 hover:text-primary-foreground'
    : 'h-9 gap-1.5 border-border/80 bg-background/80 px-3 backdrop-blur-sm';

  const primary =
    variant === 'save-delete' ? (
      <Button
        type={submitFormId ? 'submit' : 'button'}
        form={submitFormId}
        variant={onPrimary ? 'secondary' : 'default'}
        size="sm"
        className={cn(
          'h-9 gap-1.5 px-3 shadow-sm',
          onPrimary && 'bg-primary-foreground text-primary hover:bg-primary-foreground/90',
        )}
        onClick={submitFormId ? undefined : onSave}
        disabled={disabledSave}
      >
        <Save className="h-4 w-4 shrink-0" />
        {saveLabel ?? 'Save'}
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(outlineMuted)}
        onClick={onEdit}
        disabled={disabledEdit}
      >
        <Edit className="h-4 w-4 shrink-0" />
        {editLabel ?? 'Edit'}
      </Button>
    );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 pr-10',
        !onPrimary && 'border-b border-border pb-3',
        onPrimary && 'pb-0',
        className,
      )}
    >
      {primary}
      {onAux ? (
        <Button
          type="button"
          variant={auxVariant}
          size="sm"
          className={cn(outlineMuted)}
          onClick={onAux}
          disabled={disabledAux}
        >
          {auxIcon}
          {auxLabel ?? 'Action'}
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className={cn(
            'h-9 gap-1.5 px-3',
            onPrimary && 'border border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/90',
          )}
          onClick={onDelete}
          disabled={disabledDelete}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {deleteLabel ?? 'Delete'}
        </Button>
      ) : null}
    </div>
  );
}
