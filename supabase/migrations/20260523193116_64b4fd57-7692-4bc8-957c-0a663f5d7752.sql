
-- 1) Lock down profile self-updates: only username can change via REST.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (safe columns)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND wallet_balance     = (SELECT wallet_balance     FROM public.profiles WHERE user_id = auth.uid())
  AND staking_wallet     = (SELECT staking_wallet     FROM public.profiles WHERE user_id = auth.uid())
  AND mining_wallet      = (SELECT mining_wallet      FROM public.profiles WHERE user_id = auth.uid())
  AND trading_wallet     = (SELECT trading_wallet     FROM public.profiles WHERE user_id = auth.uid())
  AND is_frozen          IS NOT DISTINCT FROM (SELECT is_frozen      FROM public.profiles WHERE user_id = auth.uid())
  AND admin_notes        IS NOT DISTINCT FROM (SELECT admin_notes    FROM public.profiles WHERE user_id = auth.uid())
  AND referral_code      = (SELECT referral_code      FROM public.profiles WHERE user_id = auth.uid())
  AND referred_by        IS NOT DISTINCT FROM (SELECT referred_by    FROM public.profiles WHERE user_id = auth.uid())
  AND email              = (SELECT email              FROM public.profiles WHERE user_id = auth.uid())
);

-- 2) Atomic create_stake RPC: validates + deducts + inserts in one transaction.
CREATE OR REPLACE FUNCTION public.create_stake(p_plan_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_plan record;
  v_qualified int;
  v_avg numeric;
  v_daily numeric;
  v_end timestamptz;
  v_stake_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  SELECT * INTO v_plan FROM public.staking_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

  IF p_amount < v_plan.minimum_amount THEN
    RAISE EXCEPTION 'Minimum stake is % USDT', v_plan.minimum_amount;
  END IF;

  IF COALESCE(v_plan.required_referrals, 0) > 0 THEN
    v_qualified := public.qualified_referrals_count(v_user_id);
    IF v_qualified < v_plan.required_referrals THEN
      RAISE EXCEPTION 'Requires % qualified referrals (you have %)', v_plan.required_referrals, v_qualified;
    END IF;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF COALESCE(v_profile.staking_wallet, 0) < p_amount THEN
    RAISE EXCEPTION 'Insufficient Staking Wallet balance';
  END IF;

  v_avg := (COALESCE(v_plan.min_daily_rate, 0) + COALESCE(v_plan.max_daily_rate, 0)) / 2.0;
  v_daily := p_amount * v_avg;
  v_end := now() + (v_plan.duration_days || ' days')::interval;

  UPDATE public.profiles
    SET staking_wallet = staking_wallet - p_amount
    WHERE user_id = v_user_id;

  INSERT INTO public.stakes (user_id, plan_id, amount, daily_return, end_date)
  VALUES (v_user_id, p_plan_id, p_amount, v_daily, v_end)
  RETURNING id INTO v_stake_id;

  RETURN json_build_object('success', true, 'stake_id', v_stake_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_stake(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stake(uuid, numeric) TO authenticated;
