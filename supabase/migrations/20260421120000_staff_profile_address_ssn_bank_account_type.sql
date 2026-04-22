-- Add missing staff profile/banking columns used by the app.
alter table public.staff
  add column if not exists staff_address text,
  add column if not exists ssn text,
  add column if not exists bank_account_type text;

