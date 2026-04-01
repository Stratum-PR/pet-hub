-- Employee mobile punch in feature catalog, and business-settings feature rollout defaults.
-- min_tier = production so managers (viewer tier is always production) still see these sections.
-- Super admins can raise min_tier to staged/development in feature settings when hiding from prod preview.

UPDATE public.feature_rollout
SET min_tier = 'production', updated_at = now()
WHERE feature_key IN (
  'tax_settings',
  'receipt_personalization',
  'payment_configuration'
);

INSERT INTO public.feature_catalog (feature_key, display_name)
VALUES ('employee_mobile_punch', 'Employee punch on mobile')
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    updated_at = now();

INSERT INTO public.feature_rollout (feature_key, min_tier)
VALUES ('employee_mobile_punch', 'production')
ON CONFLICT (feature_key) DO UPDATE
SET min_tier = EXCLUDED.min_tier,
    updated_at = now();

INSERT INTO public.feature_visibility_rules (feature_key, roles, subscription_tiers)
VALUES (
  'employee_mobile_punch',
  ARRAY['manager', 'super_admin']::text[],
  ARRAY['pro']::text[]
)
ON CONFLICT (feature_key) DO UPDATE
SET roles = EXCLUDED.roles,
    subscription_tiers = EXCLUDED.subscription_tiers,
    updated_at = now();
