-- Employee birthday fields (month/day) for birthday reminders.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS birth_month INTEGER CHECK (birth_month >= 1 AND birth_month <= 12),
  ADD COLUMN IF NOT EXISTS birth_day INTEGER CHECK (birth_day >= 1 AND birth_day <= 31);

