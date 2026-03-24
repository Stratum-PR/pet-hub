-- Demo workspace manager: set birthday to current UTC calendar date (one-time per deploy).
-- Does not change staff.id (may be referenced by profiles.staff_id).
UPDATE public.staff
SET
  birth_month = EXTRACT(MONTH FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::integer,
  birth_day = EXTRACT(DAY FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::integer,
  birth_year = EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::integer - 35
WHERE business_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND email = 'demo.manager@pethub.demo';
