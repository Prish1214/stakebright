CREATE OR REPLACE FUNCTION public.place_manual_trade(p_symbol text, p_side text, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_fee numeric;
  v_pct numeric;
  v_gross numeric;
  v_net numeric;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_symbol NOT IN ('BTC','ETH','SOL') THEN RAISE EXCEPTION 'Invalid symbol'; END IF;
  IF p_side NOT IN ('BUY','SELL') THEN RAISE EXCEPTION 'Invalid side'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_profile.trading_wallet < p_amount THEN
    RAISE EXCEPTION 'Insufficient Trading Wallet balance';
  END IF;

  v_fee := round((p_amount * 0.001)::numeric, 4);              -- 0.1% fee
  v_pct := -2 + random() * 7;                                  -- -2% .. +5%
  v_gross := round((p_amount * v_pct / 100.0)::numeric, 4);
  v_net := round((v_gross - v_fee)::numeric, 4);

  UPDATE public.profiles
    SET trading_wallet = trading_wallet + v_net
    WHERE user_id = v_user_id;

  INSERT INTO public.trading_sessions(user_id, capital, ends_at, status, profit, win_rate, trades_json)
  VALUES (
    v_user_id,
    p_amount,
    now(),
    'manual',
    v_net,
    CASE WHEN v_net > 0 THEN 100 ELSE 0 END,
    jsonb_build_array(jsonb_build_object(
      'symbol', p_symbol,
      'side',   p_side,
      'fee',    v_fee,
      'gross',  v_gross,
      'net',    v_net,
      'pct',    round(v_pct::numeric, 2)
    ))
  )
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'fee',     v_fee,
    'gross',   v_gross,
    'net',     v_net,
    'pct',     round(v_pct::numeric, 2),
    'id',      v_id
  );
END;
$$;