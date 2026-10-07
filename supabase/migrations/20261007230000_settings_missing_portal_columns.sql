-- Repo migrations 20260329140000 and 20260330200000 were never applied to production, but the app and
-- get_employee_portal_settings read these columns, so employees got an error from that function.
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS payroll_pdf_include_logo text DEFAULT 'true';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS allow_employee_mobile_punch text NOT NULL DEFAULT 'false';
