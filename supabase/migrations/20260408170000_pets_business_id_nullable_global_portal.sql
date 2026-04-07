-- Portal may add pets before a business is selected; global model allows business_id NULL.
-- Aligns pets with clients.business_id nullability for multi-business client identity.

BEGIN;

ALTER TABLE public.pets
  ALTER COLUMN business_id DROP NOT NULL;

COMMIT;
