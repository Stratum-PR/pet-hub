-- Demo business: sample paid transactions with service line items + linked completed appointments,
-- plus one future appointment next month with prepaid-at-booking transaction. Idempotent fixed UUIDs.
-- Business: 00000000-0000-0000-0000-000000000001

DO $$
DECLARE
  demo UUID := '00000000-0000-0000-0000-000000000001';
  pet1 TEXT;
  pet2 TEXT;
  pet3 TEXT;
  client1 UUID;
  client2 UUID;
  client3 UUID;
  has_scheduled_date BOOLEAN;
  has_appt_date BOOLEAN;
  apt1 UUID := 'a0000001-0001-4001-8001-000000000001';
  apt2 UUID := 'a0000001-0001-4001-8001-000000000002';
  apt3 UUID := 'a0000001-0001-4001-8001-000000000003';
  apt4 UUID := 'a0000001-0001-4001-8001-000000000004';
  tx1 UUID := 'b0000001-0001-4001-8001-000000000001';
  tx2 UUID := 'b0000001-0001-4001-8001-000000000002';
  tx3 UUID := 'b0000001-0001-4001-8001-000000000003';
  tx4 UUID := 'b0000001-0001-4001-8001-000000000004';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    RAISE NOTICE 'demo_transactions_seed: skip (no transactions table)';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transaction_line_items'
  ) THEN
    RAISE NOTICE 'demo_transactions_seed: skip (no transaction_line_items table)';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'scheduled_date'
  ) INTO has_scheduled_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'appointment_date'
  ) INTO has_appt_date;

  IF NOT has_scheduled_date AND NOT has_appt_date THEN
    RAISE NOTICE 'demo_transactions_seed: skip (appointments missing date columns)';
    RETURN;
  END IF;

  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transaction_id UUID;
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS billed BOOLEAN DEFAULT false;

  -- Up to three pets (and clients) for demo business
  SELECT p.id::text, p.client_id INTO pet1, client1
  FROM public.pets p
  WHERE p.business_id = demo
  ORDER BY p.id
  LIMIT 1;

  SELECT p.id::text, p.client_id INTO pet2, client2
  FROM public.pets p
  WHERE p.business_id = demo AND (pet1 IS NULL OR p.id::text <> pet1)
  ORDER BY p.id
  LIMIT 1;

  SELECT p.id::text, p.client_id INTO pet3, client3
  FROM public.pets p
  WHERE p.business_id = demo AND (pet1 IS NULL OR p.id::text <> pet1) AND (pet2 IS NULL OR p.id::text <> pet2)
  ORDER BY p.id
  LIMIT 1;

  IF pet1 IS NULL OR client1 IS NULL THEN
    RAISE NOTICE 'demo_transactions_seed: skip (no pets/clients for demo business)';
    RETURN;
  END IF;

  IF pet2 IS NULL THEN pet2 := pet1; client2 := client1; END IF;
  IF pet3 IS NULL THEN pet3 := pet1; client3 := client1; END IF;

  IF has_scheduled_date THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'price'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'total_price'
    ) THEN
      RAISE NOTICE 'demo_transactions_seed: skip (scheduled_date appointments need price or total_price)';
      RETURN;
    END IF;
  END IF;

  -- Remove previous seed rows (after validation so we do not delete without re-inserting)
  DELETE FROM public.transaction_line_items WHERE transaction_id IN (tx1, tx2, tx3, tx4);
  DELETE FROM public.transactions WHERE id IN (tx1, tx2, tx3, tx4);
  DELETE FROM public.appointments WHERE id IN (apt1, apt2, apt3, apt4);

  -- Appointments (past completed + future scheduled)
  IF has_scheduled_date THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'price'
    ) THEN
      INSERT INTO public.appointments (
        id, business_id, pet_id, client_id, scheduled_date, service_type, status, price, notes,
        transaction_id, billed, created_at, updated_at
      ) VALUES
        (apt1::text, demo, pet1, client1, (now() - interval '5 days'), 'Arreglo Completo', 'completed', 65,
         'Demo: billed visit', NULL, false, now(), now()),
        (apt2::text, demo, pet2, client2, (now() - interval '2 days'), 'Baño Básico', 'completed', 35,
         'Demo: billed visit', NULL, false, now(), now()),
        (apt3::text, demo, pet3, client3, (now() - interval '1 day'), 'Corte de Uñas', 'completed', 15,
         'Demo: billed visit', NULL, false, now(), now()),
        (apt4::text, demo, pet1, client1, (now() + interval '35 days'), 'Baño Básico', 'scheduled', 35,
         'Demo: prepaid at booking', NULL, false, now(), now());
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'total_price'
    ) THEN
      INSERT INTO public.appointments (
        id, business_id, pet_id, client_id, scheduled_date, service_type, status, total_price, notes,
        transaction_id, billed, created_at, updated_at
      ) VALUES
        (apt1::text, demo, pet1, client1, (now() - interval '5 days'), 'Arreglo Completo', 'completed', 65.00,
         'Demo: billed visit', NULL, false, now(), now()),
        (apt2::text, demo, pet2, client2, (now() - interval '2 days'), 'Baño Básico', 'completed', 35.00,
         'Demo: billed visit', NULL, false, now(), now()),
        (apt3::text, demo, pet3, client3, (now() - interval '1 day'), 'Corte de Uñas', 'completed', 15.00,
         'Demo: billed visit', NULL, false, now(), now()),
        (apt4::text, demo, pet1, client1, (now() + interval '35 days'), 'Baño Básico', 'scheduled', 35.00,
         'Demo: prepaid at booking', NULL, false, now(), now());
    END IF;
  ELSE
    INSERT INTO public.appointments (
      id, business_id, pet_id, client_id, appointment_date, start_time, end_time,
      service_type, status, total_price, notes, transaction_id, billed, created_at, updated_at
    ) VALUES
      (apt1::text, demo, pet1, client1, (now() - interval '5 days')::date, '10:00', '11:30',
       'Arreglo Completo', 'completed', 65.00, 'Demo: billed visit', NULL, false, now(), now()),
      (apt2::text, demo, pet2, client2, (now() - interval '2 days')::date, '11:00', '11:45',
       'Baño Básico', 'completed', 35.00, 'Demo: billed visit', NULL, false, now(), now()),
      (apt3::text, demo, pet3, client3, (now() - interval '1 day')::date, '14:00', '14:20',
       'Corte de Uñas', 'completed', 15.00, 'Demo: billed visit', NULL, false, now(), now()),
      (apt4::text, demo, pet1, client1, (now() + interval '35 days')::date, '09:30', '10:15',
       'Baño Básico', 'scheduled', 35.00, 'Demo: prepaid at booking', NULL, false, now(), now());
  END IF;

  -- Transactions (cents)
  INSERT INTO public.transactions (
    id, business_id, customer_id, appointment_id, staff_id, created_at, status,
    payment_method, payment_method_secondary, subtotal, discount_amount, discount_label,
    tax_snapshot, tip_amount, total, amount_tendered, change_given, notes, transaction_number
  ) VALUES
    (tx1, demo, client1, apt1::text, NULL, now() - interval '5 days', 'paid',
     'card', NULL, 6500, 0, NULL, '[]'::jsonb, 0, 6500, 6500, NULL, 'Demo seed', 1001),
    (tx2, demo, client2, apt2::text, NULL, now() - interval '2 days', 'paid',
     'card', NULL, 3500, 0, NULL, '[]'::jsonb, 0, 3500, 3500, NULL, 'Demo seed', 1002),
    (tx3, demo, client3, apt3::text, NULL, now() - interval '1 day', 'paid',
     'cash', NULL, 1500, 0, NULL, '[]'::jsonb, 0, 1500, 1500, NULL, 'Demo seed', 1003),
    (tx4, demo, client1, apt4::text, NULL, now(), 'paid',
     'card', NULL, 3500, 0, NULL, '[]'::jsonb, 0, 3500, 3500, NULL, 'Demo seed: prepaid', 1004);

  INSERT INTO public.transaction_line_items (
    id, transaction_id, type, reference_id, name, quantity, unit_price, line_total
  ) VALUES
    (gen_random_uuid(), tx1, 'service', NULL, 'Arreglo Completo', 1, 6500, 6500),
    (gen_random_uuid(), tx2, 'service', NULL, 'Baño Básico', 1, 3500, 3500),
    (gen_random_uuid(), tx3, 'service', NULL, 'Corte de Uñas', 1, 1500, 1500),
    (gen_random_uuid(), tx4, 'service', NULL, 'Baño Básico', 1, 3500, 3500);

  UPDATE public.appointments
  SET transaction_id = tx1, billed = true, updated_at = now()
  WHERE id = apt1;
  UPDATE public.appointments
  SET transaction_id = tx2, billed = true, updated_at = now()
  WHERE id = apt2;
  UPDATE public.appointments
  SET transaction_id = tx3, billed = true, updated_at = now()
  WHERE id = apt3;
  UPDATE public.appointments
  SET transaction_id = tx4, billed = true, updated_at = now()
  WHERE id = apt4;

  RAISE NOTICE 'demo_transactions_seed: inserted 4 transactions + line items + 4 appointments';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'demo_transactions_seed: skipped or error: %', SQLERRM;
END $$;
