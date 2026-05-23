
-- =========================================
-- 1. SCHEMA CHANGES
-- =========================================

-- Profiles: new earnings columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS withdrawable_earnings NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_staking NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_mining NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings_referral NUMERIC NOT NULL DEFAULT 0;

-- Referral earnings: new kind + stake_id
ALTER TABLE public.referral_earnings
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS stake_id UUID;

-- Make deposit_id nullable now that yield_share rows don't reference a deposit
ALTER TABLE public.referral_earnings ALTER COLUMN deposit_id DROP NOT NULL;

-- Withdrawals: source ('earnings' or 'trading')
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'earnings';

-- =========================================
-- 2. DATA MIGRATION
-- =========================================

-- Migrate all existing wallet_balance into withdrawable_earnings
UPDATE public.profiles p
SET withdrawable_earnings = COALESCE(wallet_balance, 0) + COALESCE(withdrawable_earnings, 0);

-- Best-effort breakdown backfill
UPDATE public.profiles p SET
  earnings_referral = COALESCE((SELECT SUM(amount) FROM public.referral_earnings re WHERE re.referrer_id = p.user_id), 0),
  earnings_mining   = COALESCE((SELECT SUM(total_yield) FROM public.mining_rentals mr WHERE mr.user_id = p.user_id), 0),
  earnings_staking  = COALESCE((SELECT SUM(total_earned) FROM public.stakes s WHERE s.user_id = p.user_id), 0);

-- Clamp staking so the three buckets don't exceed total (residual into staking)
UPDATE public.profiles SET
  earnings_staking = GREATEST(0, withdrawable_earnings - earnings_mining - earnings_referral)
WHERE earnings_staking + earnings_mining + earnings_referral > withdrawable_earnings;

-- Zero out the legacy main wallet
UPDATE public.profiles SET wallet_balance = 0;

-- =========================================
-- 3. FUNCTION REWRITES
-- =========================================

-- Mining yield accrual: credit Withdrawable Earnings + mining bucket
CREATE OR REPLACE FUNCTION public.accrue_mining_yields()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_days_due INT;
  v_yield NUMERIC;
  v_total_credited NUMERIC := 0;
  v_completed INT := 0;
  v_pct NUMERIC;
  v_cap_time TIMESTAMPTZ;
BEGIN
  FOR r IN SELECT * FROM public.mining_rentals WHERE status='active' FOR UPDATE
  LOOP
    v_cap_time := LEAST(now(), r.ends_at);
    v_days_due := FLOOR(EXTRACT(EPOCH FROM (v_cap_time - r.last_yield_at)) / 86400)::INT;

    IF v_days_due > 0 THEN
      v_yield := 0;
      FOR i IN 1..v_days_due LOOP
        v_pct := r.daily_min_pct + random() * (r.daily_max_pct - r.daily_min_pct);
        v_yield := v_yield + round((r.locked_amount * v_pct / 100.0)::numeric, 4);
      END LOOP;

      UPDATE public.mining_rentals
        SET total_yield = total_yield + v_yield,
            last_yield_at = r.last_yield_at + (v_days_due || ' days')::interval
        WHERE id = r.id;

      UPDATE public.profiles
        SET withdrawable_earnings = COALESCE(withdrawable_earnings,0) + v_yield,
            earnings_mining = COALESCE(earnings_mining,0) + v_yield
        WHERE user_id = r.user_id;

      v_total_credited := v_total_credited + v_yield;
    END IF;

    IF now() >= r.ends_at THEN
      UPDATE public.mining_rentals SET status='completed' WHERE id=r.id;
      UPDATE public.profiles SET mining_wallet = mining_wallet + r.locked_amount WHERE user_id = r.user_id;
      v_completed := v_completed + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('credited', v_total_credited, 'completed', v_completed);
END; $$;

-- Helper: credit a referrer's yield-share for a staking earning event
CREATE OR REPLACE FUNCTION public.credit_referrer_yield_share(p_referee uuid, p_stake_id uuid, p_yield numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref uuid;
  v_share numeric;
BEGIN
  IF p_yield IS NULL OR p_yield <= 0 THEN RETURN; END IF;
  SELECT referred_by INTO v_ref FROM public.profiles WHERE user_id = p_referee;
  IF v_ref IS NULL THEN RETURN; END IF;
  v_share := round((p_yield * 0.01)::numeric, 6);
  IF v_share <= 0 THEN RETURN; END IF;

  UPDATE public.profiles
    SET withdrawable_earnings = COALESCE(withdrawable_earnings,0) + v_share,
        earnings_referral = COALESCE(earnings_referral,0) + v_share
    WHERE user_id = v_ref;

  INSERT INTO public.referral_earnings(referrer_id, referred_id, deposit_id, stake_id, amount, percentage, kind)
  VALUES (v_ref, p_referee, NULL, p_stake_id, v_share, 1, 'yield_share');
END; $$;

-- Staking exchange search: credit earnings + referrer yield share
CREATE OR REPLACE FUNCTION public.search_exchange(p_stake_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_user_id uuid := auth.uid(); v_stake record; v_plan record; v_pct numeric; v_profit numeric; v_next_allowed timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  SELECT * INTO v_stake FROM public.stakes WHERE id = p_stake_id AND user_id = v_user_id FOR UPDATE;
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
  UPDATE public.stakes SET last_search_at = now(), total_earned = COALESCE(total_earned, 0) + v_profit WHERE id = p_stake_id;
  UPDATE public.profiles
    SET withdrawable_earnings = COALESCE(withdrawable_earnings, 0) + v_profit,
        earnings_staking = COALESCE(earnings_staking, 0) + v_profit
    WHERE user_id = v_user_id;

  PERFORM public.credit_referrer_yield_share(v_user_id, p_stake_id, v_profit);

  RETURN json_build_object('success', true, 'profit', v_profit, 'percentage', round((v_pct * 100)::numeric, 3));
END; $$;

-- Mining rewards (legacy claim path)
CREATE OR REPLACE FUNCTION public.claim_mining_rewards()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_base_reward numeric := 1.0;
  v_reward numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_profile.is_mining = false THEN RAISE EXCEPTION 'No active mining session to claim'; END IF;
  IF v_profile.mining_ends_at > now() THEN RAISE EXCEPTION 'Mining session not yet finished'; END IF;
  v_reward := v_base_reward * COALESCE(v_profile.mining_power_multiplier, 1.0);
  UPDATE public.profiles
    SET total_mined = COALESCE(total_mined, 0) + v_reward,
        withdrawable_earnings = COALESCE(withdrawable_earnings, 0) + v_reward,
        earnings_mining = COALESCE(earnings_mining, 0) + v_reward,
        is_mining = false
    WHERE user_id = v_user_id;
  RETURN json_build_object('success', true, 'reward_claimed', v_reward);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_miner_rewards(p_miner_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_miner record;
  v_reward numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_miner FROM public.user_miners WHERE id=p_miner_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Miner not found'; END IF;
  IF NOT v_miner.is_mining THEN RAISE EXCEPTION 'No active session'; END IF;
  IF v_miner.mining_ends_at > now() THEN RAISE EXCEPTION 'Session not finished'; END IF;
  v_reward := round((v_miner.min_daily_return + (random() * (v_miner.max_daily_return - v_miner.min_daily_return)))::numeric, 4);
  UPDATE public.user_miners SET is_mining=false, total_mined = total_mined + v_reward WHERE id=p_miner_id;
  UPDATE public.profiles
    SET withdrawable_earnings = COALESCE(withdrawable_earnings,0) + v_reward,
        earnings_mining = COALESCE(earnings_mining,0) + v_reward
    WHERE user_id=v_user_id;
  RETURN json_build_object('success', true, 'reward', v_reward);
END; $$;

-- Deposit approval crediting: reject 'main' target
CREATE OR REPLACE FUNCTION public.handle_deposit_approved_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved')
     OR (TG_OP = 'INSERT' AND NEW.status = 'approved') THEN

    IF NEW.target_wallet NOT IN ('staking','mining','trading') THEN
      RAISE EXCEPTION 'Invalid deposit target wallet: %. Main Wallet is no longer supported.', NEW.target_wallet;
    END IF;

    BEGIN
      INSERT INTO public.deposit_credits (
        deposit_id, user_id, target_wallet, amount_received, amount_credited, source, notes
      ) VALUES (
        NEW.id, NEW.user_id, NEW.target_wallet, NEW.amount, NEW.amount,
        TG_NAME || ' / handle_deposit_approved_balance', 'Auto-credit on approval'
      );
      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      v_inserted := false;
    END;

    IF v_inserted THEN
      IF NEW.target_wallet = 'staking' THEN
        UPDATE public.profiles SET staking_wallet = COALESCE(staking_wallet,0) + NEW.amount WHERE user_id = NEW.user_id;
      ELSIF NEW.target_wallet = 'trading' THEN
        UPDATE public.profiles SET trading_wallet = COALESCE(trading_wallet,0) + NEW.amount WHERE user_id = NEW.user_id;
      ELSIF NEW.target_wallet = 'mining' THEN
        UPDATE public.profiles SET mining_wallet = COALESCE(mining_wallet,0) + NEW.amount WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Referral activation bonus on deposit approval
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer uuid;
  v_total_before numeric;
  v_total_after numeric;
  v_bonus numeric;
  v_has_activation boolean;
BEGIN
  IF OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved'
     AND NEW.target_wallet = 'staking' THEN

    SELECT referred_by INTO v_referrer FROM public.profiles WHERE user_id = NEW.user_id;
    IF v_referrer IS NULL THEN RETURN NEW; END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.referral_earnings
      WHERE referrer_id = v_referrer AND referred_id = NEW.user_id AND kind = 'activation'
    ) INTO v_has_activation;
    IF v_has_activation THEN RETURN NEW; END IF;

    SELECT COALESCE(SUM(amount),0) INTO v_total_after
      FROM public.deposits
      WHERE user_id = NEW.user_id AND status = 'approved' AND target_wallet = 'staking';

    v_total_before := v_total_after - NEW.amount;

    IF v_total_after >= 50 AND v_total_before < 50 THEN
      v_bonus := round((NEW.amount * 0.05)::numeric, 4);
      UPDATE public.profiles
        SET withdrawable_earnings = COALESCE(withdrawable_earnings,0) + v_bonus,
            earnings_referral = COALESCE(earnings_referral,0) + v_bonus
        WHERE user_id = v_referrer;
      INSERT INTO public.referral_earnings(referrer_id, referred_id, deposit_id, amount, percentage, kind)
      VALUES (v_referrer, NEW.user_id, NEW.id, v_bonus, 5, 'activation');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Wallet transfers: drop main
CREATE OR REPLACE FUNCTION public.transfer_between_wallets(p_from text, p_to text, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_from_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;
  IF p_from NOT IN ('staking','mining','trading') OR p_to NOT IN ('staking','mining','trading') THEN
    RAISE EXCEPTION 'Invalid wallet (Main Wallet is no longer supported)';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  v_from_balance := CASE p_from
    WHEN 'staking' THEN v_profile.staking_wallet
    WHEN 'mining' THEN v_profile.mining_wallet
    WHEN 'trading' THEN v_profile.trading_wallet END;
  IF v_from_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF p_from = 'staking' THEN UPDATE public.profiles SET staking_wallet = staking_wallet - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'mining' THEN UPDATE public.profiles SET mining_wallet = mining_wallet - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'trading' THEN UPDATE public.profiles SET trading_wallet = trading_wallet - p_amount WHERE user_id=v_user_id;
  END IF;
  IF p_to = 'staking' THEN UPDATE public.profiles SET staking_wallet = staking_wallet + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'mining' THEN UPDATE public.profiles SET mining_wallet = mining_wallet + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'trading' THEN UPDATE public.profiles SET trading_wallet = trading_wallet + p_amount WHERE user_id=v_user_id;
  END IF;
  INSERT INTO public.wallet_transfers (user_id, from_wallet, to_wallet, amount)
  VALUES (v_user_id, p_from, p_to, p_amount);
  RETURN json_build_object('success', true);
END; $$;

-- Admin balance adjust: support 'earnings' instead of 'main'
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user_id uuid, p_wallet text, p_delta numeric, p_note text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_wallet NOT IN ('earnings','staking','mining','trading') THEN RAISE EXCEPTION 'Invalid wallet'; END IF;

  IF p_wallet='earnings' THEN UPDATE public.profiles SET withdrawable_earnings = COALESCE(withdrawable_earnings,0)+p_delta WHERE user_id=p_user_id;
  ELSIF p_wallet='staking' THEN UPDATE public.profiles SET staking_wallet = COALESCE(staking_wallet,0)+p_delta WHERE user_id=p_user_id;
  ELSIF p_wallet='mining' THEN UPDATE public.profiles SET mining_wallet = COALESCE(mining_wallet,0)+p_delta WHERE user_id=p_user_id;
  ELSIF p_wallet='trading' THEN UPDATE public.profiles SET trading_wallet = COALESCE(trading_wallet,0)+p_delta WHERE user_id=p_user_id;
  END IF;

  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'adjust_balance', 'user', p_user_id::text,
          jsonb_build_object('wallet', p_wallet, 'delta', p_delta, 'note', p_note));
  RETURN json_build_object('success', true);
END; $$;

-- Admin withdrawal processing: refund into the original source
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(p_id uuid, p_action text, p_note text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE w record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  IF p_action='approve' THEN
    UPDATE public.withdrawals SET status='completed', processed_by=auth.uid(), processed_at=now(), admin_notes=p_note WHERE id=p_id;
  ELSE
    UPDATE public.withdrawals SET status='rejected', processed_by=auth.uid(), processed_at=now(), admin_notes=p_note WHERE id=p_id;
    IF w.source = 'trading' THEN
      UPDATE public.profiles SET trading_wallet = COALESCE(trading_wallet,0) + w.amount WHERE user_id = w.user_id;
    ELSE
      UPDATE public.profiles SET withdrawable_earnings = COALESCE(withdrawable_earnings,0) + w.amount,
                                  earnings_staking = COALESCE(earnings_staking,0) + w.amount
        WHERE user_id = w.user_id;
    END IF;
  END IF;

  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'withdrawal_'||p_action, 'withdrawal', p_id::text, jsonb_build_object('note', p_note));
  RETURN json_build_object('success', true);
END; $$;

-- New: request a withdrawal (frontend RPC)
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_source text, p_amount numeric, p_address text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile record;
  v_fee_pct numeric;
  v_min numeric;
  v_fee numeric;
  v_net numeric;
  v_balance numeric;
  v_id uuid;
  v_st numeric; v_mn numeric; v_rf numeric; v_tot numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user);
  IF p_source NOT IN ('earnings','trading') THEN RAISE EXCEPTION 'Invalid source'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_address IS NULL OR length(p_address) < 10 THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;
  IF p_address !~ '^0x[a-fA-F0-9]{40}$' THEN RAISE EXCEPTION 'Address must be a valid BEP-20 (0x...) address'; END IF;

  SELECT COALESCE(NULLIF(setting_value,'')::numeric, 10) INTO v_fee_pct FROM public.system_settings WHERE setting_key='withdrawal_fee_percentage';
  v_fee_pct := COALESCE(v_fee_pct, 10);
  SELECT COALESCE(NULLIF(setting_value,'')::numeric, 10) INTO v_min FROM public.system_settings WHERE setting_key='minimum_withdrawal';
  v_min := COALESCE(v_min, 10);

  IF p_amount < v_min THEN RAISE EXCEPTION 'Minimum withdrawal is % USDT', v_min; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  v_balance := CASE p_source WHEN 'earnings' THEN COALESCE(v_profile.withdrawable_earnings,0)
                              WHEN 'trading' THEN COALESCE(v_profile.trading_wallet,0) END;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_fee := round((p_amount * v_fee_pct / 100.0)::numeric, 4);
  v_net := p_amount - v_fee;

  IF p_source = 'trading' THEN
    UPDATE public.profiles SET trading_wallet = trading_wallet - p_amount WHERE user_id = v_user;
  ELSE
    -- pro-rata debit of breakdown counters
    v_st := COALESCE(v_profile.earnings_staking,0);
    v_mn := COALESCE(v_profile.earnings_mining,0);
    v_rf := COALESCE(v_profile.earnings_referral,0);
    v_tot := v_st + v_mn + v_rf;
    IF v_tot <= 0 THEN
      UPDATE public.profiles
        SET withdrawable_earnings = withdrawable_earnings - p_amount,
            earnings_staking = GREATEST(0, withdrawable_earnings - p_amount)
        WHERE user_id = v_user;
    ELSE
      UPDATE public.profiles
        SET withdrawable_earnings = withdrawable_earnings - p_amount,
            earnings_staking  = GREATEST(0, earnings_staking  - round((p_amount * v_st / v_tot)::numeric, 6)),
            earnings_mining   = GREATEST(0, earnings_mining   - round((p_amount * v_mn / v_tot)::numeric, 6)),
            earnings_referral = GREATEST(0, earnings_referral - round((p_amount * v_rf / v_tot)::numeric, 6))
        WHERE user_id = v_user;
    END IF;
  END IF;

  INSERT INTO public.withdrawals(user_id, amount, fee_amount, net_amount, withdrawal_address, withdrawal_type, source, status)
  VALUES (v_user, p_amount, v_fee, v_net, p_address, p_source, p_source, 'pending')
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'withdrawal_id', v_id, 'fee', v_fee, 'net', v_net);
END; $$;

-- Rewrite qualified_referrals_count: staking-target deposits only
CREATE OR REPLACE FUNCTION public.qualified_referrals_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT p.user_id
    FROM public.profiles p
    LEFT JOIN public.deposits d
      ON d.user_id = p.user_id AND d.status = 'approved' AND d.target_wallet = 'staking'
    WHERE p.referred_by = _user_id
    GROUP BY p.user_id
    HAVING COALESCE(SUM(d.amount), 0) >= 50
  ) q;
$$;

-- Staking referral team uses staking-target deposits
DROP FUNCTION IF EXISTS public.get_staking_referral_team();
CREATE OR REPLACE FUNCTION public.get_staking_referral_team()
RETURNS TABLE(user_id uuid, username text, created_at timestamptz, total_staking_deposits numeric, qualified boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.username, p.created_at,
    COALESCE((SELECT sum(amount) FROM public.deposits d
              WHERE d.user_id = p.user_id AND d.status='approved' AND d.target_wallet='staking'), 0) AS total_staking_deposits,
    COALESCE((SELECT sum(amount) FROM public.deposits d
              WHERE d.user_id = p.user_id AND d.status='approved' AND d.target_wallet='staking'), 0) >= 50 AS qualified
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC;
$$;
