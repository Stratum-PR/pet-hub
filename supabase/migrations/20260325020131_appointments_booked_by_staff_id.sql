-- Who logged the booking vs optional assignee (staff_id = fulfiller, nullable).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booked_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_booked_by_staff_id
  ON public.appointments (booked_by_staff_id)
  WHERE booked_by_staff_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.staff_id IS 'Optional: staff member assigned to perform the service.';
COMMENT ON COLUMN public.appointments.booked_by_staff_id IS 'Staff profile linked to the user who created this appointment (checkout attribution).';
