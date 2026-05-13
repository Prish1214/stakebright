
-- 1. Add wallet balance columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staking_wallet numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mining_wallet numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trading_wallet numeric NOT NULL DEFAULT 0;

-- 2. wallet_transfers table
CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transfers" ON public.wallet_transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transfers" ON public.wallet_transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage transfers" ON public.wallet_transfers FOR ALL USING (has_role(auth.uid(),'admin'::app_role));

-- 3. user_miners table
CREATE TABLE IF NOT EXISTS public.user_miners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  miner_type text NOT NULL,           -- BTC | LTC | DOGE
  miner_tier text NOT NULL,           -- Basic | Pro | Elite
  hashrate numeric NOT NULL,
  efficiency numeric NOT NULL,
  lifespan_days integer NOT NULL,
  price numeric NOT NULL,
  min_daily_return numeric NOT NULL,
  max_daily_return numeric NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_started_at timestamptz,
  mining_ends_at timestamptz,
  is_mining boolean NOT NULL DEFAULT false,
  total_mined numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_miners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own miners" ON public.user_miners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own miners" ON public.user_miners FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own miners" ON public.user_miners FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage miners" ON public.user_miners FOR ALL USING (has_role(auth.uid(),'admin'::app_role));

-- 4. trading_sessions table
CREATE TABLE IF NOT EXISTS public.trading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  capital numeric NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  profit numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  trades_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active', -- active | claimed
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sessions" ON public.trading_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.trading_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.trading_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage sessions" ON public.trading_sessions FOR ALL USING (has_role(auth.uid(),'admin'::app_role));

-- 5. transfer_between_wallets RPC
CREATE OR REPLACE FUNCTION public.transfer_between_wallets(
  p_from text,
  p_to text,
  p_amount numeric
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_from_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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

  -- Deduct
  IF p_from = 'main' THEN UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'staking' THEN UPDATE public.profiles SET staking_wallet = staking_wallet - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'mining' THEN UPDATE public.profiles SET mining_wallet = mining_wallet - p_amount WHERE user_id=v_user_id;
  ELSIF p_from = 'trading' THEN UPDATE public.profiles SET trading_wallet = trading_wallet - p_amount WHERE user_id=v_user_id;
  END IF;

  -- Credit
  IF p_to = 'main' THEN UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'staking' THEN UPDATE public.profiles SET staking_wallet = staking_wallet + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'mining' THEN UPDATE public.profiles SET mining_wallet = mining_wallet + p_amount WHERE user_id=v_user_id;
  ELSIF p_to = 'trading' THEN UPDATE public.profiles SET trading_wallet = trading_wallet + p_amount WHERE user_id=v_user_id;
  END IF;

  INSERT INTO public.wallet_transfers (user_id, from_wallet, to_wallet, amount)
  VALUES (v_user_id, p_from, p_to, p_amount);

  RETURN json_build_object('success', true);
END;
$$;

-- 6. purchase_miner RPC
CREATE OR REPLACE FUNCTION public.purchase_miner(
  p_type text,
  p_tier text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_price numeric;
  v_hashrate numeric;
  v_efficiency numeric;
  v_lifespan integer;
  v_min numeric;
  v_max numeric;
  v_new_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_type NOT IN ('BTC','LTC','DOGE') THEN RAISE EXCEPTION 'Invalid miner type'; END IF;
  IF p_tier NOT IN ('Basic','Pro','Elite') THEN RAISE EXCEPTION 'Invalid tier'; END IF;

  -- Pricing matrix
  IF p_tier='Basic' THEN v_price:=50; v_hashrate:=10; v_efficiency:=85; v_lifespan:=30; v_min:=0.5; v_max:=1.5;
  ELSIF p_tier='Pro' THEN v_price:=200; v_hashrate:=50; v_efficiency:=92; v_lifespan:=60; v_min:=2.5; v_max:=5.0;
  ELSE v_price:=750; v_hashrate:=200; v_efficiency:=98; v_lifespan:=90; v_min:=10; v_max:=20;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_user_id FOR UPDATE;
  IF v_profile.mining_wallet < v_price THEN RAISE EXCEPTION 'Insufficient Mining Wallet balance'; END IF;

  UPDATE public.profiles SET mining_wallet = mining_wallet - v_price WHERE user_id=v_user_id;

  INSERT INTO public.user_miners(user_id, miner_type, miner_tier, hashrate, efficiency, lifespan_days, price, min_daily_return, max_daily_return, expires_at)
  VALUES (v_user_id, p_type, p_tier, v_hashrate, v_efficiency, v_lifespan, v_price, v_min, v_max, now() + (v_lifespan || ' days')::interval)
  RETURNING id INTO v_new_id;

  RETURN json_build_object('success', true, 'miner_id', v_new_id);
END;
$$;

-- 7. start_miner RPC
CREATE OR REPLACE FUNCTION public.start_miner(p_miner_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_miner record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_miner FROM public.user_miners WHERE id=p_miner_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Miner not found'; END IF;
  IF v_miner.expires_at <= now() THEN RAISE EXCEPTION 'Miner expired'; END IF;
  IF v_miner.is_mining AND v_miner.mining_ends_at > now() THEN RAISE EXCEPTION 'Already mining'; END IF;
  IF v_miner.is_mining AND v_miner.mining_ends_at <= now() THEN RAISE EXCEPTION 'Claim previous rewards first'; END IF;

  UPDATE public.user_miners
  SET is_mining=true, last_started_at=now(), mining_ends_at=now()+interval '24 hours'
  WHERE id=p_miner_id;
  RETURN json_build_object('success', true, 'ends_at', now()+interval '24 hours');
END;
$$;

-- 8. claim_miner_rewards RPC
CREATE OR REPLACE FUNCTION public.claim_miner_rewards(p_miner_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  UPDATE public.user_miners
  SET is_mining=false, total_mined = total_mined + v_reward
  WHERE id=p_miner_id;

  UPDATE public.profiles SET mining_wallet = mining_wallet + v_reward WHERE user_id=v_user_id;

  RETURN json_build_object('success', true, 'reward', v_reward);
END;
$$;

-- 9. start_trading_session RPC
CREATE OR REPLACE FUNCTION public.start_trading_session()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_active record;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id=v_user_id FOR UPDATE;
  IF v_profile.trading_wallet <= 0 THEN RAISE EXCEPTION 'Trading Wallet is empty. Transfer funds first.'; END IF;

  SELECT * INTO v_active FROM public.trading_sessions
   WHERE user_id=v_user_id AND status='active'
   ORDER BY started_at DESC LIMIT 1;
  IF FOUND AND v_active.ends_at > now() THEN RAISE EXCEPTION 'Trading session already running'; END IF;
  IF FOUND AND v_active.ends_at <= now() THEN RAISE EXCEPTION 'Claim previous session first'; END IF;

  INSERT INTO public.trading_sessions(user_id, capital, ends_at)
  VALUES (v_user_id, v_profile.trading_wallet, now()+interval '24 hours')
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'session_id', v_id);
END;
$$;

-- 10. claim_trading_session RPC
CREATE OR REPLACE FUNCTION public.claim_trading_session()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session record;
  v_pct numeric;
  v_profit numeric;
  v_win_rate numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_session FROM public.trading_sessions
    WHERE user_id=v_user_id AND status='active'
    ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active session'; END IF;
  IF v_session.ends_at > now() THEN RAISE EXCEPTION 'Session not finished'; END IF;

  -- Variable PnL between -1% and +6%
  v_pct := -1 + random() * 7;
  v_profit := round((v_session.capital * v_pct / 100.0)::numeric, 4);
  v_win_rate := round((55 + random() * 35)::numeric, 1);

  UPDATE public.trading_sessions
    SET status='claimed', profit=v_profit, win_rate=v_win_rate
    WHERE id=v_session.id;

  UPDATE public.profiles SET trading_wallet = trading_wallet + v_profit WHERE user_id=v_user_id;

  RETURN json_build_object('success', true, 'profit', v_profit, 'win_rate', v_win_rate);
END;
$$;
