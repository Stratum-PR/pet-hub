-- Assign every employee a unique 4-digit PIN per business (0000–9999).
-- Skips values equal to the first 4 digits of a 6-digit kiosk_manager_pin for that business.

DO $$
DECLARE
  r_business RECORD;
  r_emp RECORD;
  v_pin TEXT;
  v_tries INT;
  v_ok BOOLEAN;
  v_used TEXT[];
  v_mgr_prefix TEXT;
BEGIN
  FOR r_business IN SELECT id FROM public.businesses
  LOOP
    v_used := ARRAY[]::TEXT[];

    SELECT CASE
      WHEN kiosk_manager_pin IS NOT NULL
        AND length(trim(kiosk_manager_pin)) = 6
        AND kiosk_manager_pin ~ '^[0-9]+$'
      THEN substring(kiosk_manager_pin FROM 1 FOR 4)
      ELSE NULL
    END INTO v_mgr_prefix
    FROM public.businesses
    WHERE id = r_business.id;

    FOR r_emp IN
      SELECT id FROM public.employees WHERE business_id = r_business.id ORDER BY id
    LOOP
      v_tries := 0;
      v_ok := false;

      WHILE v_tries < 800 AND NOT v_ok LOOP
        v_tries := v_tries + 1;
        v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');

        IF v_pin = ANY (v_used) THEN
          CONTINUE;
        END IF;

        IF v_mgr_prefix IS NOT NULL AND v_pin = v_mgr_prefix THEN
          CONTINUE;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM public.employees e
          WHERE e.business_id = r_business.id
            AND e.id <> r_emp.id
            AND e.pin = v_pin
        ) THEN
          CONTINUE;
        END IF;

        UPDATE public.employees
        SET
          pin = v_pin,
          pin_set_at = COALESCE(pin_set_at, now()),
          pin_required = false,
          updated_at = now()
        WHERE id = r_emp.id;

        v_used := array_append(v_used, v_pin);
        v_ok := true;
      END LOOP;

      IF NOT v_ok THEN
        RAISE EXCEPTION
          'assign_unique_employee_pins: could not assign PIN for business % employee %',
          r_business.id,
          r_emp.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;
