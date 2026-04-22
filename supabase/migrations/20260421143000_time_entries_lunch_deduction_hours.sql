alter table public.time_entries
  add column if not exists lunch_deduction_hours numeric not null default 0;

