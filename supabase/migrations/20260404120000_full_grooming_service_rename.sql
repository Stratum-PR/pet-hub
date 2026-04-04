-- Normalize Full Grooming service name + Spanish description (legacy seed / custom names).
UPDATE public.services
SET
  name = 'Full Grooming',
  description = 'Lavado, secado y corte de uñas'
WHERE name = 'Full Grooming (Lavado + Secado + Uñas)';
