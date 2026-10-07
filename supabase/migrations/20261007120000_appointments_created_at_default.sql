-- New appointments were saved with created_at/updated_at = null (no column default).
alter table public.appointments alter column created_at set default now();
alter table public.appointments alter column updated_at set default now();
