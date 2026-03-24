-- Optional business logo on exported payroll PDF reports.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS payroll_pdf_include_logo text DEFAULT 'true';

UPDATE public.settings
SET payroll_pdf_include_logo = COALESCE(payroll_pdf_include_logo, 'true');
