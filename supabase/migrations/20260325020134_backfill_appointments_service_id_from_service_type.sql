-- Backfill appointments.service_id from service_type text where missing.
-- booked_by_staff_id left NULL for legacy rows (no historical "who booked" source).

UPDATE public.appointments a
SET service_id = s.id
FROM public.services s
WHERE a.service_id IS NULL
  AND a.business_id IS NOT DISTINCT FROM s.business_id
  AND NULLIF(trim(a.service_type), '') IS NOT NULL
  AND lower(trim(split_part(a.service_type, ',', 1))) = lower(trim(s.name));

UPDATE public.appointments a
SET service_id = s.id
FROM public.services s
WHERE a.service_id IS NULL
  AND a.business_id IS NOT DISTINCT FROM s.business_id
  AND NULLIF(trim(a.service_type), '') IS NOT NULL
  AND lower(trim(split_part(a.service_type, ',', 2))) = lower(trim(s.name))
  AND trim(split_part(a.service_type, ',', 2)) <> '';

UPDATE public.appointments a
SET service_id = s.id
FROM public.services s
WHERE a.service_id IS NULL
  AND a.business_id IS NOT DISTINCT FROM s.business_id
  AND NULLIF(trim(a.service_type), '') IS NOT NULL
  AND lower(trim(split_part(a.service_type, ',', 3))) = lower(trim(s.name))
  AND trim(split_part(a.service_type, ',', 3)) <> '';
