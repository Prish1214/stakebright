-- Freeze enforcement at DB level
CREATE OR REPLACE FUNCTION public.assert_not_frozen(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_frozen boolean;
BEGIN
  SELECT is_frozen INTO v_frozen FROM public.profiles WHERE user_id = _user_id;
  IF COALESCE(v_frozen, false) THEN
    RAISE EXCEPTION 'Your account is frozen. Please contact support.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Trigger to block writes from frozen users on financial tables
CREATE OR REPLACE FUNCTION public.block_frozen_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_frozen boolean;
BEGIN
  -- skip when admin acts (e.g., status updates)
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  SELECT is_frozen INTO v_frozen FROM public.profiles WHERE user_id = NEW.user_id;
  IF COALESCE(v_frozen, false) THEN
    RAISE EXCEPTION 'Your account is frozen. Please contact support.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_frozen_deposits ON public.deposits;
CREATE TRIGGER trg_block_frozen_deposits
BEFORE INSERT ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.block_frozen_user_writes();

DROP TRIGGER IF EXISTS trg_block_frozen_withdrawals ON public.withdrawals;
CREATE TRIGGER trg_block_frozen_withdrawals
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.block_frozen_user_writes();

DROP TRIGGER IF EXISTS trg_block_frozen_stakes ON public.stakes;
CREATE TRIGGER trg_block_frozen_stakes
BEFORE INSERT ON public.stakes
FOR EACH ROW EXECUTE FUNCTION public.block_frozen_user_writes();

DROP TRIGGER IF EXISTS trg_block_frozen_transfers ON public.wallet_transfers;
CREATE TRIGGER trg_block_frozen_transfers
BEFORE INSERT ON public.wallet_transfers
FOR EACH ROW EXECUTE FUNCTION public.block_frozen_user_writes();

-- Patch RPCs to also assert not frozen up-front
CREATE OR REPLACE FUNCTION public.transfer_between_wallets(p_from text, p_to text, p_amount numeric)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_from_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;
  IF p_from NOT IN ('main','staking','mining','trading') OR p_to NOT IN ('main','staking','mining','trading') THEN
    RAISE EXCEPTION 'Invalid wallet';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  v_from_balance := CASE p_from
    WHEN 'main' THEN v_profile.wallet_balance
    WHEN 'staking' THEN v_profile.staking_wallet
    WHEN 'mining' THEN v_profile.mining_wallet
    WHEN 'trading' THEN v_profile.trading_wallet END;
  IF v_from_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF p_from = 'main' THEN UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'staking' THEN UPDATE public.profiles SET staking_wallet = staking_wallet - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'mining' THEN UPDATE public.profiles SET mining_wallet = mining_wallet - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'trading' THEN UPDATE public.profiles SET trading_wallet = trading_wallet - p_amount WHERE user_id=v_user_id;
  END IF;
  IF p_to = 'main' THEN UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'staking' THEN UPDATE public.profiles SET staking_wallet = staking_wallet + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'mining' THEN UPDATE public.profiles SET mining_wallet = mining_wallet + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'trading' THEN UPDATE public.profiles SET trading_wallet = trading_wallet + p_amount WHERE user_id=v_user_id;
  END IF;
  INSERT INTO public.wallet_transfers (user_id, from_wallet, to_wallet, amount)
  VALUES (v_user_id, p_from, p_to, p_amount);
  RETURN json_build_object('success', true);
END; $$;

-- Wrap freeze assertion into other action RPCs by adding a check at top
CREATE OR REPLACE FUNCTION public.start_cloud_mining()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_active_stakes record;
  v_multiplier numeric := 1.0;
  v_new_streak integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_profile.is_mining = true AND v_profile.mining_ends_at > now() THEN RAISE EXCEPTION 'Mining is still active'; END IF;
  IF v_profile.is_mining = true AND v_profile.mining_ends_at <= now() THEN RAISE EXCEPTION 'Please claim your previous mining rewards first'; END IF;
  SELECT string_agg(sp.name, ',') as plan_names, count(s.id) as stake_count
  INTO v_active_stakes
  FROM public.stakes s JOIN public.staking_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = v_user_id AND s.is_active = true;
  IF v_active_stakes.stake_count = 0 THEN RAISE EXCEPTION 'Mining requires an active staking plan'; END IF;
  IF v_active_stakes.plan_names ILIKE '%Platinum%' THEN v_multiplier := 2.0;
  ELSIF v_active_stakes.plan_names ILIKE '%Gold%' THEN v_multiplier := 1.5;
  ELSE v_multiplier := 1.0; END IF;
  IF v_profile.mining_ends_at IS NOT NULL AND now() <= v_profile.mining_ends_at + interval '48 hours' THEN
    v_new_streak := COALESCE(v_profile.mining_streak, 0) + 1;
  ELSE v_new_streak := 1; END IF;
  UPDATE public.profiles SET mining_streak = v_new_streak, last_mining_start = now(),
    mining_ends_at = now() + interval '24 hours', is_mining = true, mining_power_multiplier = v_multiplier
  WHERE user_id = v_user_id;
  RETURN json_build_object('success', true, 'new_streak', v_new_streak, 'new_multiplier', v_multiplier, 'ends_at', now() + interval '24 hours');
END; $$;

CREATE OR REPLACE FUNCTION public.start_miner(p_miner_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user_id uuid := auth.uid(); v_miner record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  SELECT * INTO v_miner FROM public.user_miners WHERE id=p_miner_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Miner not found'; END IF;
  IF v_miner.expires_at <= now() THEN RAISE EXCEPTION 'Miner expired'; END IF;
  IF v_miner.is_mining AND v_miner.mining_ends_at > now() THEN RAISE EXCEPTION 'Already mining'; END IF;
  IF v_miner.is_mining AND v_miner.mining_ends_at <= now() THEN RAISE EXCEPTION 'Claim previous rewards first'; END IF;
  UPDATE public.user_miners SET is_mining=true, last_started_at=now(), mining_ends_at=now()+interval '24 hours' WHERE id=p_miner_id;
  RETURN json_build_object('success', true, 'ends_at', now()+interval '24 hours');
END; $$;

CREATE OR REPLACE FUNCTION public.purchase_miner(p_type text, p_tier text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_profile record;
  v_price numeric; v_hashrate numeric; v_efficiency numeric; v_lifespan integer; v_min numeric; v_max numeric; v_new_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  IF p_type NOT IN ('BTC','LTC','DOGE') THEN RAISE EXCEPTION 'Invalid miner type'; END IF;
  IF p_tier NOT IN ('Basic','Pro','Elite') THEN RAISE EXCEPTION 'Invalid tier'; END IF;
  IF p_tier='Basic' THEN v_price:=50; v_hashrate:=10; v_efficiency:=85; v_lifespan:=30; v_min:=0.5; v_max:=1.5;
  ELSIF p_tier='Pro' THEN v_price:=200; v_hashrate:=50; v_efficiency:=92; v_lifespan:=60; v_min:=2.5; v_max:=5.0;
  ELSE v_price:=750; v_hashrate:=200; v_efficiency:=98; v_lifespan:=90; v_min:=10; v_max:=20; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_user_id FOR UPDATE;
  IF v_profile.mining_wallet < v_price THEN RAISE EXCEPTION 'Insufficient Mining Wallet balance'; END IF;
  UPDATE public.profiles SET mining_wallet = mining_wallet - v_price WHERE user_id=v_user_id;
  INSERT INTO public.user_miners(user_id, miner_type, miner_tier, hashrate, efficiency, lifespan_days, price, min_daily_return, max_daily_return, expires_at)
  VALUES (v_user_id, p_type, p_tier, v_hashrate, v_efficiency, v_lifespan, v_price, v_min, v_max, now() + (v_lifespan || ' days')::interval)
  RETURNING id INTO v_new_id;
  RETURN json_build_object('success', true, 'miner_id', v_new_id);
END; $$;

CREATE OR REPLACE FUNCTION public.start_trading_session()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user_id uuid := auth.uid(); v_profile record; v_active record; v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_user_id FOR UPDATE;
  IF v_profile.trading_wallet <= 0 THEN RAISE EXCEPTION 'Trading Wallet is empty. Transfer funds first.'; END IF;
  SELECT * INTO v_active FROM public.trading_sessions WHERE user_id=v_user_id AND status='active' ORDER BY started_at DESC LIMIT 1;
  IF FOUND AND v_active.ends_at > now() THEN RAISE EXCEPTION 'Trading session already running'; END IF;
  IF FOUND AND v_active.ends_at <= now() THEN RAISE EXCEPTION 'Claim previous session first'; END IF;
  INSERT INTO public.trading_sessions(user_id, capital, ends_at) VALUES (v_user_id, v_profile.trading_wallet, now()+interval '24 hours') RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'session_id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.run_ai_scalping()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_profile RECORD; v_refs int; v_level int := 0;
  v_min numeric := 0; v_max numeric := 0; v_pct numeric; v_profit numeric;
  v_last_at timestamptz; v_next_at timestamptz; v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF COALESCE(v_profile.trading_wallet,0) < 100 THEN RAISE EXCEPTION 'Minimum 100 USDT Trading Wallet balance required for Level 1'; END IF;
  SELECT MAX(started_at) INTO v_last_at FROM public.trading_sessions WHERE user_id = v_user_id AND status = 'scalp';
  IF v_last_at IS NOT NULL AND v_last_at + interval '24 hours' > now() THEN
    v_next_at := v_last_at + interval '24 hours';
    RAISE EXCEPTION 'Next AI Scalp available at % UTC', to_char(v_next_at, 'YYYY-MM-DD HH24:MI:SS');
  END IF;
  v_refs := public.qualified_trading_referrals_count(v_user_id);
  IF v_profile.trading_wallet >= 30000 AND v_refs >= 100 THEN v_level := 6; v_min := 3.2; v_max := 3.5;
  ELSIF v_profile.trading_wallet >= 12000 AND v_refs >= 50 THEN v_level := 5; v_min := 2.2; v_max := 2.6;
  ELSIF v_profile.trading_wallet >= 5000 AND v_refs >= 20 THEN v_level := 4; v_min := 1.85; v_max := 2.0;
  ELSIF v_profile.trading_wallet >= 1500 AND v_refs >= 8 THEN v_level := 3; v_min := 1.5; v_max := 1.7;
  ELSIF v_profile.trading_wallet >= 500 AND v_refs >= 3 THEN v_level := 2; v_min := 1.05; v_max := 1.2;
  ELSE v_level := 1; v_min := 0.8; v_max := 1.0; END IF;
  v_pct := v_min + random() * (v_max - v_min);
  v_profit := round((v_profile.trading_wallet * v_pct / 100.0)::numeric, 4);
  UPDATE public.profiles SET trading_wallet = trading_wallet + v_profit WHERE user_id = v_user_id;
  INSERT INTO public.trading_sessions(user_id, capital, ends_at, status, profit, win_rate, trades_json)
  VALUES (v_user_id, v_profile.trading_wallet, now(), 'scalp', v_profit, round((70 + random() * 25)::numeric, 1),
    jsonb_build_object('level', v_level, 'pct', round(v_pct::numeric, 3), 'refs', v_refs))
  RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'level', v_level, 'profit', v_profit, 'pct', round(v_pct::numeric, 3),
    'refs', v_refs, 'next_at', now() + interval '24 hours', 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.search_exchange(p_stake_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_profit WHERE user_id = v_user_id;
  RETURN json_build_object('success', true, 'profit', v_profit, 'percentage', round((v_pct * 100)::numeric, 3));
END; $$;

CREATE OR REPLACE FUNCTION public.start_mining_rental(p_coin text, p_tier text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_profile RECORD;
  v_price NUMERIC; v_days INT; v_min NUMERIC; v_max NUMERIC; v_eff NUMERIC; v_hash NUMERIC; v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user_id);
  IF p_coin NOT IN ('BTC','LTC','DOGE') THEN RAISE EXCEPTION 'Invalid coin'; END IF;
  IF p_tier NOT IN ('Basic','Pro','Elite') THEN RAISE EXCEPTION 'Invalid tier'; END IF;
  IF p_coin='BTC' AND p_tier='Basic' THEN v_price:=50;  v_days:=30; v_min:=0.7; v_max:=1.0; v_eff:=88; v_hash:=10;
  ELSIF p_coin='BTC' AND p_tier='Pro'   THEN v_price:=200; v_days:=60; v_min:=1.0; v_max:=1.2; v_eff:=93; v_hash:=50;
  ELSIF p_coin='BTC' AND p_tier='Elite' THEN v_price:=750; v_days:=90; v_min:=1.2; v_max:=1.5; v_eff:=98; v_hash:=200;
  ELSIF p_coin='LTC' AND p_tier='Basic' THEN v_price:=40;  v_days:=30; v_min:=0.9; v_max:=1.2; v_eff:=88; v_hash:=15;
  ELSIF p_coin='LTC' AND p_tier='Pro'   THEN v_price:=180; v_days:=60; v_min:=1.1; v_max:=1.4; v_eff:=93; v_hash:=70;
  ELSIF p_coin='LTC' AND p_tier='Elite' THEN v_price:=700; v_days:=90; v_min:=1.4; v_max:=1.7; v_eff:=98; v_hash:=250;
  ELSIF p_coin='DOGE' AND p_tier='Basic' THEN v_price:=30;  v_days:=20; v_min:=1.2; v_max:=1.5; v_eff:=88; v_hash:=20;
  ELSIF p_coin='DOGE' AND p_tier='Pro'   THEN v_price:=150; v_days:=45; v_min:=1.5; v_max:=1.9; v_eff:=93; v_hash:=90;
  ELSIF p_coin='DOGE' AND p_tier='Elite' THEN v_price:=600; v_days:=75; v_min:=1.8; v_max:=2.3; v_eff:=98; v_hash:=300;
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_user_id FOR UPDATE;
  IF v_profile.mining_wallet < v_price THEN RAISE EXCEPTION 'Insufficient Mining Wallet balance'; END IF;
  UPDATE public.profiles SET mining_wallet = mining_wallet - v_price WHERE user_id=v_user_id;
  INSERT INTO public.mining_rentals(user_id, coin, tier, locked_amount, runtime_days, daily_min_pct, daily_max_pct, efficiency, hashrate, ends_at)
  VALUES (v_user_id, p_coin, p_tier, v_price, v_days, v_min, v_max, v_eff, v_hash, now() + (v_days || ' days')::interval)
  RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'rental_id', v_id, 'locked', v_price, 'ends_at', now() + (v_days || ' days')::interval);
END; $$;