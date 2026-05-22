
-- Drop manual trading
DROP FUNCTION IF EXISTS public.place_manual_trade(text, text, numeric);

-- Helper: count referrals that are themselves Level 1+ (trading_wallet >= 100)
CREATE OR REPLACE FUNCTION public.qualified_trading_referrals_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.profiles p
  WHERE p.referred_by = _user_id
    AND COALESCE(p.trading_wallet, 0) >= 100;
$$;

-- AI Scalping runner
CREATE OR REPLACE FUNCTION public.run_ai_scalping()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile RECORD;
  v_refs int;
  v_level int := 0;
  v_min numeric := 0;
  v_max numeric := 0;
  v_pct numeric;
  v_profit numeric;
  v_last_at timestamptz;
  v_next_at timestamptz;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;

  IF COALESCE(v_profile.trading_wallet,0) < 100 THEN
    RAISE EXCEPTION 'Minimum 100 USDT Trading Wallet balance required for Level 1';
  END IF;

  -- 24h cooldown
  SELECT MAX(started_at) INTO v_last_at
  FROM public.trading_sessions
  WHERE user_id = v_user_id AND status = 'scalp';
  IF v_last_at IS NOT NULL AND v_last_at + interval '24 hours' > now() THEN
    v_next_at := v_last_at + interval '24 hours';
    RAISE EXCEPTION 'Next AI Scalp available at % UTC', to_char(v_next_at, 'YYYY-MM-DD HH24:MI:SS');
  END IF;

  v_refs := public.qualified_trading_referrals_count(v_user_id);

  -- Determine level (highest qualifying)
  IF v_profile.trading_wallet >= 30000 AND v_refs >= 100 THEN
    v_level := 6; v_min := 3.2; v_max := 3.5;
  ELSIF v_profile.trading_wallet >= 12000 AND v_refs >= 50 THEN
    v_level := 5; v_min := 2.2; v_max := 2.6;
  ELSIF v_profile.trading_wallet >= 5000 AND v_refs >= 20 THEN
    v_level := 4; v_min := 1.85; v_max := 2.0;
  ELSIF v_profile.trading_wallet >= 1500 AND v_refs >= 8 THEN
    v_level := 3; v_min := 1.5; v_max := 1.7;
  ELSIF v_profile.trading_wallet >= 500 AND v_refs >= 3 THEN
    v_level := 2; v_min := 1.05; v_max := 1.2;
  ELSE
    v_level := 1; v_min := 0.8; v_max := 1.0;
  END IF;

  v_pct := v_min + random() * (v_max - v_min);
  v_profit := round((v_profile.trading_wallet * v_pct / 100.0)::numeric, 4);

  UPDATE public.profiles
    SET trading_wallet = trading_wallet + v_profit
    WHERE user_id = v_user_id;

  INSERT INTO public.trading_sessions(user_id, capital, ends_at, status, profit, win_rate, trades_json)
  VALUES (
    v_user_id,
    v_profile.trading_wallet,
    now(),
    'scalp',
    v_profit,
    round((70 + random() * 25)::numeric, 1),
    jsonb_build_object('level', v_level, 'pct', round(v_pct::numeric, 3), 'refs', v_refs)
  )
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'level', v_level,
    'profit', v_profit,
    'pct', round(v_pct::numeric, 3),
    'refs', v_refs,
    'next_at', now() + interval '24 hours',
    'id', v_id
  );
END;
$$;
