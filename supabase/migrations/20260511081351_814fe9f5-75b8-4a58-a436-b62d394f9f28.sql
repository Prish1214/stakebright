CREATE OR REPLACE FUNCTION public.complete_expired_stakes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  completed_count integer := 0;
BEGIN
  UPDATE public.stakes s
  SET
    is_active = false,
    total_earned = GREATEST(
      COALESCE(s.total_earned, 0),
      COALESCE(s.daily_return, 0) * COALESCE(sp.duration_days, 0)
    )
  FROM public.staking_plans sp
  WHERE s.plan_id = sp.id
    AND s.is_active = true
    AND s.end_date <= now();

  GET DIAGNOSTICS completed_count = ROW_COUNT;
  RETURN completed_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_daily_staking_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stake_record RECORD;
  daily_earning numeric;
  maximum_earning numeric;
BEGIN
  PERFORM public.complete_expired_stakes();

  FOR stake_record IN
    SELECT s.id, s.amount, s.total_earned, sp.daily_return_rate, sp.duration_days
    FROM public.stakes s
    JOIN public.staking_plans sp ON s.plan_id = sp.id
    WHERE s.is_active = true
      AND s.end_date > now()
  LOOP
    daily_earning := stake_record.amount * stake_record.daily_return_rate;
    maximum_earning := daily_earning * stake_record.duration_days;

    UPDATE public.stakes
    SET
      daily_return = daily_earning,
      total_earned = LEAST(
        maximum_earning,
        GREATEST(COALESCE(total_earned, 0), 0) + daily_earning
      )
    WHERE id = stake_record.id;
  END LOOP;

  PERFORM public.complete_expired_stakes();
END;
$function$;

SELECT public.complete_expired_stakes();