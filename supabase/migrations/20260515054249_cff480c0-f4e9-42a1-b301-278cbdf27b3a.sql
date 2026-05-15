CREATE OR REPLACE FUNCTION public.add_daily_staking_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  stake_record RECORD;
  daily_earning numeric;
  days_elapsed integer;
  expected_earned numeric;
  maximum_earning numeric;
BEGIN
  PERFORM public.complete_expired_stakes();

  FOR stake_record IN
    SELECT s.id, s.amount, s.start_date, s.end_date, sp.daily_return_rate, sp.duration_days
    FROM public.stakes s
    JOIN public.staking_plans sp ON s.plan_id = sp.id
    WHERE s.is_active = true
  LOOP
    daily_earning   := stake_record.amount * stake_record.daily_return_rate;
    maximum_earning := daily_earning * stake_record.duration_days;

    -- Whole 24h periods elapsed since stake start, capped at plan duration.
    days_elapsed := LEAST(
      stake_record.duration_days,
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - stake_record.start_date)) / 86400)::integer)
    );

    expected_earned := daily_earning * days_elapsed;

    UPDATE public.stakes
    SET
      daily_return = daily_earning,
      total_earned = LEAST(maximum_earning, expected_earned)
    WHERE id = stake_record.id;
  END LOOP;

  PERFORM public.complete_expired_stakes();
END;
$$;