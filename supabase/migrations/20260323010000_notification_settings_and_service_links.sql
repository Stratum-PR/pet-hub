-- Extend notifications with additional deep-link metadata and add settings toggles.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS service_id uuid,
  ADD COLUMN IF NOT EXISTS employee_id uuid;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS notify_appointment_unbilled text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS notify_inventory_low_stock text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS notify_payment_overdue text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS notify_birthdays text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS notify_general text DEFAULT 'true';

UPDATE public.settings
SET
  notify_appointment_unbilled = COALESCE(notify_appointment_unbilled, 'true'),
  notify_inventory_low_stock = COALESCE(notify_inventory_low_stock, 'true'),
  notify_payment_overdue = COALESCE(notify_payment_overdue, 'true'),
  notify_birthdays = COALESCE(notify_birthdays, 'true'),
  notify_general = COALESCE(notify_general, 'true');
