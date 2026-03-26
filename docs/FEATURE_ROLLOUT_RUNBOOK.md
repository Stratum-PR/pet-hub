# Feature Rollout Runbook

## Scope

This runbook governs feature tagging for UI visibility and backend activation.
It applies to all feature keys configured in:

- `public.feature_catalog`
- `public.feature_rollout`
- `public.feature_visibility_rules`

## Defaults for new features

When a super admin adds a new feature in Admin Dashboard -> Feature Settings:

- roles: `super_admin`
- subscription tiers: `standard`
- environment tier (`min_tier`): `development`

## Tier behavior matrix

`min_tier` controls where the feature is active/visible:

- `development`: dev only
- `staged`: staging + development
- `production`: production + staging + development

Demotion behavior:

- `production -> staged`: turns the feature off in production.
- `production -> development`: turns the feature off in production and staging.

## Role and subscription filtering

- Roles and subscription tiers are configured per feature in `feature_visibility_rules`.
- `roles = ['*']` means all roles.
- `subscription_tiers = ['*']` means all plans.

## Super-admin controls

- Feature settings and tier controls are super-admin only.
- Non-super-admin sessions cannot override viewer tier server-side.

## Geofencing reference behavior

- `clock_in_out` calls `check_geofence`.
- `check_geofence` now gates on `feature_is_active('geofencing', viewer_tier)`.
- When inactive, geofencing fails open and does not block punch clock.

## Incident triage SQL

```sql
-- Current rollout tier for a feature
select feature_key, min_tier, updated_at
from public.feature_rollout
where feature_key = 'geofencing';

-- Visibility rules for a feature
select feature_key, roles, subscription_tiers, updated_at
from public.feature_visibility_rules
where feature_key = 'geofencing';
```
