-- Revert optional retail column (was used for client-profile purchase insights tied to pet species).
ALTER TABLE public.inventory DROP COLUMN IF EXISTS target_species;
