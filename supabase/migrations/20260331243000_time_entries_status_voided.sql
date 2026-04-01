-- Soft-void mistaken or incorrect time entries (excluded from payroll; not deleted).

ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_status_check;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_status_check
  CHECK (
    status IS NULL
    OR status = ANY (
      ARRAY[
        'active'::text,
        'pending_edit'::text,
        'approved'::text,
        'rejected'::text,
        'voided'::text
      ]
    )
  );

COMMENT ON COLUMN public.time_entries.status IS
  'active | pending_edit | approved | rejected | voided — voided entries are kept for audit but excluded from pay.';
