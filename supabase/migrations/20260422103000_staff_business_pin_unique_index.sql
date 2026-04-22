-- Plan 1: enforce custom employee PIN uniqueness per business.
-- This prevents duplicate clock-in PINs within the same business.

DO $$
DECLARE
  r_staff RECORD;
  v_new_pin TEXT;
BEGIN
  FOR r_staff IN
    SELECT id, business_id
    FROM (
      SELECT
        s.id,
        s.business_id,
        row_number() OVER (
          PARTITION BY s.business_id, s.pin
          ORDER BY s.created_at NULLS LAST, s.id
        ) AS rn
      FROM public.staff s
      WHERE s.pin IS NOT NULL
        AND btrim(s.pin) <> ''
    ) d
    WHERE d.rn > 1
  LOOP
    SELECT lpad(gs::text, 4, '0')
    INTO v_new_pin
    FROM generate_series(0, 9999) AS gs
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.staff s2
      WHERE s2.business_id = r_staff.business_id
        AND s2.pin = lpad(gs::text, 4, '0')
    )
    ORDER BY gs
    LIMIT 1;

    IF v_new_pin IS NULL THEN
      RAISE EXCEPTION
        'Could not resolve duplicate PIN for staff % in business %: no free 4-digit PINs available',
        r_staff.id,
        r_staff.business_id;
    END IF;

    UPDATE public.staff
    SET pin = v_new_pin,
        pin_set_at = COALESCE(pin_set_at, now()),
        updated_at = now()
    WHERE id = r_staff.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_business_pin_unique
ON public.staff (business_id, pin)
WHERE pin IS NOT NULL AND btrim(pin) <> '';
