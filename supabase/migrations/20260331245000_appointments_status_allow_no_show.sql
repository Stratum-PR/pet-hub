-- Appointments.status: allow app statuses (no_show, confirmed, in_progress, etc.) and legacy hyphen forms.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status IN (
      'scheduled',
      'confirmed',
      'in_progress',
      'in-progress',
      'completed',
      'cancelled',
      'canceled',
      'no_show',
      'no-show'
    )
  );
