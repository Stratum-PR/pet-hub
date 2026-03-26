-- Set requested features to Development + (Manager, Super Admin) + Pro.
-- Also ensures missing settings features exist in feature catalog/list.

WITH target_features(feature_key, display_name) AS (
  VALUES
    ('appointment_book', 'Appointment Book'),
    ('appointments', 'Appointments'),
    ('barcode_lookup', 'Barcode Lookup'),
    ('booking_settings', 'Booking Settings'),
    ('inventory', 'Inventory'),
    ('payments', 'Payments'),
    ('transaction_create', 'Transaction Create'),
    ('transaction_detail', 'Transaction Detail'),
    ('transactions_list', 'Transactions List'),
    ('tax_settings', 'Tax Settings'),
    ('receipt_personalization', 'Receipt Personalization'),
    ('payment_configuration', 'Payment Configuration')
)
INSERT INTO public.feature_catalog (feature_key, display_name)
SELECT feature_key, display_name
FROM target_features
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    updated_at = now();

WITH target_features(feature_key) AS (
  VALUES
    ('appointment_book'),
    ('appointments'),
    ('barcode_lookup'),
    ('booking_settings'),
    ('inventory'),
    ('payments'),
    ('transaction_create'),
    ('transaction_detail'),
    ('transactions_list'),
    ('tax_settings'),
    ('receipt_personalization'),
    ('payment_configuration')
)
INSERT INTO public.feature_rollout (feature_key, min_tier)
SELECT feature_key, 'development'
FROM target_features
ON CONFLICT (feature_key) DO UPDATE
SET min_tier = EXCLUDED.min_tier,
    updated_at = now();

WITH target_features(feature_key) AS (
  VALUES
    ('appointment_book'),
    ('appointments'),
    ('barcode_lookup'),
    ('booking_settings'),
    ('inventory'),
    ('payments'),
    ('transaction_create'),
    ('transaction_detail'),
    ('transactions_list'),
    ('tax_settings'),
    ('receipt_personalization'),
    ('payment_configuration')
)
INSERT INTO public.feature_visibility_rules (feature_key, roles, subscription_tiers)
SELECT feature_key, ARRAY['manager','super_admin']::text[], ARRAY['pro']::text[]
FROM target_features
ON CONFLICT (feature_key) DO UPDATE
SET roles = EXCLUDED.roles,
    subscription_tiers = EXCLUDED.subscription_tiers,
    updated_at = now();
