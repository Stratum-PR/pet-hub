import { Edit, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DetailModalActionBarProps = {
  className?: string;
  /** Edit + delete (default). */
  variant?: 'edit-delete' | 'save-delete';
  onEdit?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  saveLabel?: string;
  disabledEdit?: boolean;
  disabledDelete?: boolean;
  disabledSave?: boolean;
};

/**
 * Top-of-modal actions: consistent outline Edit (or primary Save) + destructive Delete.
 * Leave room for the dialog close (X) via `pr-10` on the parent or this bar.
 */
export function DetailModalActionBar({
  className,
  variant = 'edit-delete',
  onEdit,
  onDelete,
  onSave,
  editLabel,
  deleteLabel,
  saveLabel,
  disabledEdit,
  disabledDelete,
  disabledSave,
}: DetailModalActionBarProps) {
  const primary =
    variant === 'save-delete' ? (
      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-9 gap-1.5 px-3 shadow-sm"
        onClick={onSave}
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
        className="h-9 gap-1.5 border-border/80 bg-background/80 px-3 backdrop-blur-sm"
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
        'flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3 pr-10',
        className
      )}
    >
      {primary}
      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-9 gap-1.5 px-3"
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
