
-- Extend staking_plans
ALTER TABLE public.staking_plans
  ADD COLUMN IF NOT EXISTS min_daily_rate numeric,
  ADD COLUMN IF NOT EXISTS max_daily_rate numeric,
  ADD COLUMN IF NOT EXISTS required_referrals integer NOT NULL DEFAULT 0;

-- Extend stakes
ALTER TABLE public.stakes
  ADD COLUMN IF NOT EXISTS last_search_at timestamptz;

-- Replace plans: deactivate old, insert new three tiers
UPDATE public.staking_plans SET is_active = false;

INSERT INTO public.staking_plans (name, duration_days, daily_return_rate, minimum_amount, min_daily_rate, max_daily_rate, required_referrals, is_active)
VALUES
  ('Silver Stake',   30, 0.008, 25,   0.007, 0.009, 0,  true),
  ('Gold Stake',     60, 0.011, 300,  0.010, 0.012, 5,  true),
  ('Platinum Stake', 90, 0.0155,1000, 0.014, 0.017, 15, true);

-- Qualified referrals helper: referred users with approved deposits totaling >= $50
CREATE OR REPLACE FUNCTION public.qualified_referrals_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT p.user_id
    FROM public.profiles p
    LEFT JOIN public.deposits d
      ON d.user_id = p.user_id AND d.status = 'approved'
    WHERE p.referred_by = _user_id
    GROUP BY p.user_id
    HAVING COALESCE(SUM(d.amount), 0) >= 50
  ) q;
$$;

-- Make legacy daily cron a no-op (profits now via Search Exchange)
CREATE OR REPLACE FUNCTION public.add_daily_staking_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.complete_expired_stakes();
END;
$$;

-- Search Exchange: generate random profit within plan range, credit main wallet, 24h cooldown
CREATE OR REPLACE FUNCTION public.search_exchange(p_stake_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_stake record;
  v_plan record;
  v_pct numeric;
  v_profit numeric;
  v_next_allowed timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_stake FROM public.stakes
    WHERE id = p_stake_id AND user_id = v_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stake not found'; END IF;
  IF NOT v_stake.is_active THEN RAISE EXCEPTION 'Stake is not active'; END IF;
  IF v_stake.end_date <= now() THEN RAISE EXCEPTION 'Stake period has ended'; END IF;

  IF v_stake.last_search_at IS NOT NULL AND v_stake.last_search_at + interval '24 hours' > now() THEN
    v_next_allowed := v_stake.last_search_at + interval '24 hours';
    RAISE EXCEPTION 'Next search available at %', to_char(v_next_allowed, 'YYYY-MM-DD HH24:MI:SS UTC');
  END IF;

  SELECT * INTO v_plan FROM public.staking_plans WHERE id = v_stake.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

  v_pct := v_plan.min_daily_rate + random() * (v_plan.max_daily_rate - v_plan.min_daily_rate);
  v_profit := round((v_stake.amount * v_pct)::numeric, 4);

  UPDATE public.stakes
    SET last_search_at = now(),
        total_earned = COALESCE(total_earned, 0) + v_profit
    WHERE id = p_stake_id;

  UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_profit
    WHERE user_id = v_user_id;

  RETURN json_build_object(
    'success', true,
    'profit', v_profit,
    'percentage', round((v_pct * 100)::numeric, 3)
  );
END;
$$;
