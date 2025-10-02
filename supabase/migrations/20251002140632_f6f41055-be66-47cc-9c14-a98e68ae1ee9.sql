-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the daily staking earnings function to run every day at midnight UTC
SELECT cron.schedule(
  'add-daily-staking-earnings',
  '0 0 * * *',
  'SELECT public.add_daily_staking_earnings();'
);