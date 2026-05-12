ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_mined numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS mining_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_mining_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS mining_ends_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_mining boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mining_power_multiplier numeric DEFAULT 1.0;

CREATE OR REPLACE FUNCTION public.start_cloud_mining()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_active_stakes record;
  v_multiplier numeric := 1.0;
  v_new_streak integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_profile.is_mining = true AND v_profile.mining_ends_at > now() THEN
    RAISE EXCEPTION 'Mining is still active';
  END IF;

  IF v_profile.is_mining = true AND v_profile.mining_ends_at <= now() THEN
    RAISE EXCEPTION 'Please claim your previous mining rewards first';
  END IF;

  -- Check active stakes for new session
  SELECT string_agg(sp.name, ',') as plan_names, count(s.id) as stake_count
  INTO v_active_stakes
  FROM public.stakes s
  JOIN public.staking_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = v_user_id AND s.is_active = true;

  IF v_active_stakes.stake_count = 0 THEN
    RAISE EXCEPTION 'Mining requires an active staking plan';
  END IF;

  IF v_active_stakes.plan_names ILIKE '%Platinum%' THEN
    v_multiplier := 2.0;
  ELSIF v_active_stakes.plan_names ILIKE '%Gold%' THEN
    v_multiplier := 1.5;
  ELSE
    v_multiplier := 1.0;
  END IF;

  -- Calculate streak
  IF v_profile.mining_ends_at IS NOT NULL AND now() <= v_profile.mining_ends_at + interval '48 hours' THEN
    v_new_streak := COALESCE(v_profile.mining_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET 
    mining_streak = v_new_streak,
    last_mining_start = now(),
    mining_ends_at = now() + interval '24 hours',
    is_mining = true,
    mining_power_multiplier = v_multiplier
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'success', true,
    'new_streak', v_new_streak,
    'new_multiplier', v_multiplier,
    'ends_at', now() + interval '24 hours'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mining_rewards()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_base_reward numeric := 1.0; -- 1 USDT per 24h
  v_reward numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_profile.is_mining = false THEN
    RAISE EXCEPTION 'No active mining session to claim';
  END IF;

  IF v_profile.mining_ends_at > now() THEN
    RAISE EXCEPTION 'Mining session not yet finished';
  END IF;

  v_reward := v_base_reward * COALESCE(v_profile.mining_power_multiplier, 1.0);

  UPDATE public.profiles
  SET 
    total_mined = COALESCE(total_mined, 0) + v_reward,
    wallet_balance = COALESCE(wallet_balance, 0) + v_reward,
    is_mining = false
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'success', true,
    'reward_claimed', v_reward
  );
END;
$$;