-- Make address column nullable
ALTER TABLE public.clients ALTER COLUMN address DROP NOT NULL;