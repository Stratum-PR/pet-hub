-- Link revenue data to appointments:
-- 1) Every completed appointment without a transaction gets a paid transaction + service line item
--    (created_at = COALESCE(scheduled_date, appointment_date at UTC, created_at) so revenue aligns with service date).
-- 2) Next calendar month, scheduled/confirmed appointments without a transaction get a prepaid
--    paid transaction (created_at = appointment.created_at — paid at booking).
-- Idempotent: skips rows that already have a matching transaction.

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS transaction_id UUID;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS billed BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------------
-- 1) Completed appointments → paid transactions
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT
    a.id,
    a.business_id,
    COALESCE(
      a.client_id,
      a.customer_id,
      (SELECT p.client_id FROM public.pets p WHERE p.id::text = a.pet_id::text LIMIT 1)
    ) AS cust_id,
    COALESCE(
      a.scheduled_date,
      a.appointment_date::timestamp AT TIME ZONE 'UTC',
      a.created_at,
      now()
    ) AS service_at,
    a.service_type,
    GREATEST(
      1::bigint,
      COALESCE(
        CASE WHEN a.price IS NOT NULL AND a.price > 0 THEN (a.price::bigint * 100) END,
        CASE WHEN a.total_price IS NOT NULL THEN ROUND(a.total_price::numeric * 100)::bigint END,
        5000::bigint
      )
    ) AS cents
  FROM public.appointments a
  WHERE a.status = 'completed'
    AND a.business_id IS NOT NULL
    AND COALESCE(
      a.client_id,
      a.customer_id,
      (SELECT p.client_id FROM public.pets p WHERE p.id::text = a.pet_id::text LIMIT 1)
    ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.business_id = a.business_id
        AND (
          t.appointment_id = a.id::text
          OR (a.transaction_id IS NOT NULL AND t.id = a.transaction_id)
        )
    )
),
ins AS (
  INSERT INTO public.transactions (
    business_id,
    customer_id,
    appointment_id,
    staff_id,
    created_at,
    status,
    payment_method,
    payment_method_secondary,
    subtotal,
    discount_amount,
    tax_snapshot,
    tip_amount,
    total,
    amount_tendered,
    change_given,
    notes
  )
  SELECT
    b.business_id,
    b.cust_id,
    b.id::text,
    NULL,
    b.service_at,
    'paid',
    CASE WHEN abs(hashtext(b.id::text)) % 3 = 0 THEN 'cash' ELSE 'card' END,
    NULL,
    b.cents,
    0,
    '[]'::jsonb,
    0,
    b.cents,
    b.cents,
    NULL,
    'pet-hub:migration-20260322140000-completed'
  FROM base b
  RETURNING id, appointment_id
)
INSERT INTO public.transaction_line_items (
  transaction_id,
  type,
  reference_id,
  name,
  quantity,
  unit_price,
  line_total
)
SELECT
  i.id,
  'service',
  NULL,
  COALESCE(NULLIF(TRIM(a.service_type), ''), 'Service'),
  1,
  b.cents,
  b.cents
FROM ins i
JOIN base b ON b.id::text = i.appointment_id
JOIN public.appointments a ON a.id::text = i.appointment_id;

UPDATE public.appointments a
SET
  transaction_id = t.id,
  billed = true,
  updated_at = now()
FROM public.transactions t
WHERE t.appointment_id = a.id::text
  AND t.notes = 'pet-hub:migration-20260322140000-completed';

-- ---------------------------------------------------------------------------
-- 2) Next month — scheduled / confirmed — prepaid at booking
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT
    a.id,
    a.business_id,
    COALESCE(
      a.client_id,
      a.customer_id,
      (SELECT p.client_id FROM public.pets p WHERE p.id::text = a.pet_id::text LIMIT 1)
    ) AS cust_id,
    COALESCE(
      a.scheduled_date,
      a.appointment_date::timestamp AT TIME ZONE 'UTC',
      a.created_at,
      now()
    ) AS service_at,
    a.created_at AS booked_at,
    a.service_type,
    GREATEST(
      1::bigint,
      COALESCE(
        CASE WHEN a.price IS NOT NULL AND a.price > 0 THEN (a.price::bigint * 100) END,
        CASE WHEN a.total_price IS NOT NULL THEN ROUND(a.total_price::numeric * 100)::bigint END,
        5000::bigint
      )
    ) AS cents
  FROM public.appointments a
  WHERE COALESCE(
      a.scheduled_date,
      a.appointment_date::timestamp AT TIME ZONE 'UTC',
      a.created_at,
      now()
    ) >= date_trunc('month', (CURRENT_DATE + INTERVAL '1 month')::timestamp)
    AND COALESCE(
      a.scheduled_date,
      a.appointment_date::timestamp AT TIME ZONE 'UTC',
      a.created_at,
      now()
    ) < date_trunc('month', (CURRENT_DATE + INTERVAL '2 months')::timestamp)
    AND a.status IN ('scheduled', 'confirmed')
    AND a.business_id IS NOT NULL
    AND COALESCE(
      a.client_id,
      a.customer_id,
      (SELECT p.client_id FROM public.pets p WHERE p.id::text = a.pet_id::text LIMIT 1)
    ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.business_id = a.business_id
        AND (
          t.appointment_id = a.id::text
          OR (a.transaction_id IS NOT NULL AND t.id = a.transaction_id)
        )
    )
),
ins AS (
  INSERT INTO public.transactions (
    business_id,
    customer_id,
    appointment_id,
    staff_id,
    created_at,
    status,
    payment_method,
    payment_method_secondary,
    subtotal,
    discount_amount,
    tax_snapshot,
    tip_amount,
    total,
    amount_tendered,
    change_given,
    notes
  )
  SELECT
    b.business_id,
    b.cust_id,
    b.id::text,
    NULL,
    b.booked_at,
    'paid',
    CASE WHEN abs(hashtext(b.id::text)) % 3 = 0 THEN 'cash' ELSE 'card' END,
    NULL,
    b.cents,
    0,
    '[]'::jsonb,
    0,
    b.cents,
    b.cents,
    NULL,
    'pet-hub:migration-20260322140000-prepaid'
  FROM base b
  RETURNING id, appointment_id
)
INSERT INTO public.transaction_line_items (
  transaction_id,
  type,
  reference_id,
  name,
  quantity,
  unit_price,
  line_total
)
SELECT
  i.id,
  'service',
  NULL,
  COALESCE(NULLIF(TRIM(a.service_type), ''), 'Service'),
  1,
  b.cents,
  b.cents
FROM ins i
JOIN base b ON b.id::text = i.appointment_id
JOIN public.appointments a ON a.id::text = i.appointment_id;

UPDATE public.appointments a
SET
  transaction_id = t.id,
  billed = true,
  updated_at = now()
FROM public.transactions t
WHERE t.appointment_id = a.id::text
  AND t.notes = 'pet-hub:migration-20260322140000-prepaid';
