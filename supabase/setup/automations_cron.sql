-- One-time setup: run the run-automations Edge Function every day at 9:00 AM Puerto Rico (13:00 UTC).
-- Apply AFTER migration 20261010200000_automations.sql and after deploying the run-automations function.
-- Safe to re-run. Replace <PROJECT_REF> with the Supabase project ref before running.
-- The secret is generated here and never leaves the database: the function checks it with
-- public.automation_cron_secret_matches() using the service role.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'automations_cron_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'automations_cron_secret',
      'Shared secret for the daily run-automations call');
  END IF;
END $$;

-- Re-create the job so the schedule/URL can be changed by re-running this file.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'run-automations-daily';

SELECT cron.schedule(
  'run-automations-daily',
  '0 13 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/run-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automations_cron_secret')
    ),
    body := '{"mode":"run"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

-- Check:   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'run-automations-daily';
-- Last runs: SELECT status, return_message, start_time FROM cron.job_run_details
--            WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'run-automations-daily')
--            ORDER BY start_time DESC LIMIT 5;
--
-- Undo:
--   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'run-automations-daily';
--   DELETE FROM vault.secrets WHERE name = 'automations_cron_secret';
