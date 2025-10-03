-- Backfill accumulated earnings for existing active stakes
UPDATE public.stakes
SET total_earned = GREATEST(
  0,
  daily_return * EXTRACT(DAY FROM (LEAST(NOW(), end_date) - start_date))
)
WHERE is_active = true 
AND total_earned = 0
AND start_date < NOW();