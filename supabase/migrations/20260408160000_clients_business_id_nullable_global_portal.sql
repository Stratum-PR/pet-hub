-- Global portal client rows use business_id IS NULL (canonical identity per profile_id).
-- Older schemas may still have NOT NULL on clients.business_id; align with 20260407140000.

BEGIN;

ALTER TABLE public.clients
  ALTER COLUMN business_id DROP NOT NULL;

COMMIT;
