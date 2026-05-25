CREATE OR REPLACE FUNCTION public.staking_referral_qualifying_total(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE((
      SELECT SUM(d.amount)
      FROM public.deposits d
      WHERE d.user_id = _user_id
        AND d.status = 'approved'
        AND d.target_wallet = 'staking'
    ), 0)
    +
    COALESCE((
      SELECT SUM((l.metadata->>'delta')::numeric)
      FROM public.admin_activity_logs l
      WHERE l.target_type = 'user'
        AND l.target_id = _user_id::text
        AND l.action IN ('adjust_balance', 'credit_reward')
        AND l.metadata->>'wallet' = 'staking'
        AND (l.metadata->>'delta') ~ '^-?[0-9]+(\.[0-9]+)?$'
        AND (l.metadata->>'delta')::numeric > 0
    ), 0);
$function$;

CREATE OR REPLACE FUNCTION public.grant_staking_referral_activation_bonus(
  p_referee uuid,
  p_qualifying_amount numeric,
  p_deposit_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer uuid;
  v_has_activation boolean;
  v_total numeric;
  v_bonus numeric;
BEGIN
  IF p_referee IS NULL OR p_qualifying_amount IS NULL OR p_qualifying_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT referred_by INTO v_referrer
  FROM public.profiles
  WHERE user_id = p_referee;

  IF v_referrer IS NULL OR v_referrer = p_referee THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.referral_earnings re
    WHERE re.referrer_id = v_referrer
      AND re.referred_id = p_referee
      AND (
        re.kind = 'activation'
        OR EXISTS (
          SELECT 1
          FROM public.deposits d
          WHERE d.id = re.deposit_id
            AND d.target_wallet = 'staking'
            AND d.status = 'approved'
        )
      )
  ) INTO v_has_activation;

  IF v_has_activation THEN
    RETURN;
  END IF;

  v_total := public.staking_referral_qualifying_total(p_referee);
  IF v_total < 50 THEN
    RETURN;
  END IF;

  v_bonus := round((p_qualifying_amount * 0.05)::numeric, 4);
  IF v_bonus <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET withdrawable_earnings = COALESCE(withdrawable_earnings, 0) + v_bonus,
      earnings_referral = COALESCE(earnings_referral, 0) + v_bonus
  WHERE user_id = v_referrer;

  INSERT INTO public.referral_earnings(referrer_id, referred_id, deposit_id, amount, percentage, kind)
  VALUES (v_referrer, p_referee, p_deposit_id, v_bonus, 5, 'activation');
END;
$function$;

CREATE OR REPLACE FUNCTION public.qualified_referrals_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::int
  FROM public.profiles p
  WHERE p.referred_by = _user_id
    AND public.staking_referral_qualifying_total(p.user_id) >= 50;
$function$;

CREATE OR REPLACE FUNCTION public.get_staking_referral_team()
RETURNS TABLE(user_id uuid, username text, created_at timestamp with time zone, total_staking_deposits numeric, qualified boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.username,
    p.created_at,
    public.staking_referral_qualifying_total(p.user_id) AS total_staking_deposits,
    public.staking_referral_qualifying_total(p.user_id) >= 50 AS qualified
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY qualified DESC, total_staking_deposits DESC, p.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_after numeric;
  v_total_before numeric;
BEGIN
  IF OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved'
     AND NEW.target_wallet = 'staking' THEN
    v_total_after := public.staking_referral_qualifying_total(NEW.user_id);
    v_total_before := v_total_after - COALESCE(NEW.amount, 0);

    IF v_total_before < 50 AND v_total_after >= 50 THEN
      PERFORM public.grant_staking_referral_activation_bonus(NEW.user_id, NEW.amount, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user_id uuid, p_wallet text, p_delta numeric, p_note text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_staking_qual_before numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_wallet NOT IN ('earnings','staking','mining','trading') THEN RAISE EXCEPTION 'Invalid wallet'; END IF;

  IF p_wallet = 'staking' AND p_delta > 0 THEN
    v_staking_qual_before := public.staking_referral_qualifying_total(p_user_id);
  END IF;

  IF p_wallet='earnings' THEN
    UPDATE public.profiles
    SET withdrawable_earnings = GREATEST(0, COALESCE(withdrawable_earnings,0)+p_delta),
        earnings_staking = CASE WHEN p_delta > 0 THEN COALESCE(earnings_staking,0)+p_delta ELSE earnings_staking END
    WHERE user_id=p_user_id;
  ELSIF p_wallet='staking' THEN
    UPDATE public.profiles SET staking_wallet = GREATEST(0, COALESCE(staking_wallet,0)+p_delta) WHERE user_id=p_user_id;
  ELSIF p_wallet='mining' THEN
    UPDATE public.profiles SET mining_wallet = GREATEST(0, COALESCE(mining_wallet,0)+p_delta) WHERE user_id=p_user_id;
  ELSIF p_wallet='trading' THEN
    UPDATE public.profiles SET trading_wallet = GREATEST(0, COALESCE(trading_wallet,0)+p_delta) WHERE user_id=p_user_id;
  END IF;

  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'adjust_balance', 'user', p_user_id::text,
          jsonb_build_object('wallet', p_wallet, 'delta', p_delta, 'note', p_note));

  IF p_wallet = 'staking' AND p_delta > 0 AND v_staking_qual_before < 50
     AND public.staking_referral_qualifying_total(p_user_id) >= 50 THEN
    PERFORM public.grant_staking_referral_activation_bonus(p_user_id, p_delta, NULL);
  END IF;

  RETURN json_build_object('success', true);
END;
$function$;

ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_withdrawal_type_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_withdrawal_type_check
  CHECK (withdrawal_type = ANY (ARRAY['earnings'::text, 'trading'::text, 'principal'::text]));

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_source text, p_amount numeric, p_address text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_profile record;
  v_fee_pct numeric;
  v_min numeric;
  v_fee numeric;
  v_net numeric;
  v_balance numeric;
  v_id uuid;
  v_st numeric;
  v_mn numeric;
  v_rf numeric;
  v_tot numeric;
  v_source text;
  v_address text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user);

  v_source := lower(trim(COALESCE(p_source, '')));
  v_address := trim(COALESCE(p_address, ''));

  IF v_source NOT IN ('earnings','trading') THEN RAISE EXCEPTION 'Invalid source'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF length(v_address) < 10 THEN RAISE EXCEPTION 'Invalid wallet address'; END IF;
  IF v_address !~ '^0x[a-fA-F0-9]{40}$' THEN RAISE EXCEPTION 'Address must be a valid BEP-20 (0x...) address'; END IF;

  SELECT COALESCE(NULLIF(setting_value,'')::numeric, 10)
  INTO v_fee_pct
  FROM public.system_settings
  WHERE setting_key='withdrawal_fee_percentage';
  v_fee_pct := COALESCE(v_fee_pct, 10);

  SELECT COALESCE(NULLIF(setting_value,'')::numeric, 10)
  INTO v_min
  FROM public.system_settings
  WHERE setting_key='minimum_withdrawal';
  v_min := COALESCE(v_min, 10);

  IF p_amount < v_min THEN RAISE EXCEPTION 'Minimum withdrawal is % USDT', v_min; END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF v_source = 'earnings' THEN
    v_st := GREATEST(COALESCE(v_profile.earnings_staking,0), 0);
    v_mn := GREATEST(COALESCE(v_profile.earnings_mining,0), 0);
    v_rf := GREATEST(COALESCE(v_profile.earnings_referral,0), 0);
    v_tot := v_st + v_mn + v_rf;
    v_balance := GREATEST(COALESCE(v_profile.withdrawable_earnings,0), v_tot);
  ELSE
    v_balance := GREATEST(COALESCE(v_profile.trading_wallet,0), 0);
  END IF;

  IF v_balance + 0.000001 < p_amount THEN
    RAISE EXCEPTION 'Insufficient % balance. Available: % USDT',
      CASE WHEN v_source = 'earnings' THEN 'withdrawable earnings' ELSE 'trading wallet' END,
      round(v_balance::numeric, 6);
  END IF;

  v_fee := round((p_amount * v_fee_pct / 100.0)::numeric, 4);
  v_net := p_amount - v_fee;

  IF v_source = 'trading' THEN
    UPDATE public.profiles
    SET trading_wallet = GREATEST(0, COALESCE(trading_wallet,0) - p_amount)
    WHERE user_id = v_user;
  ELSE
    IF v_tot <= 0 THEN
      UPDATE public.profiles
      SET withdrawable_earnings = GREATEST(0, v_balance - p_amount),
          earnings_staking = GREATEST(0, v_balance - p_amount),
          earnings_mining = 0,
          earnings_referral = 0
      WHERE user_id = v_user;
    ELSE
      UPDATE public.profiles
      SET withdrawable_earnings = GREATEST(0, v_balance - p_amount),
          earnings_staking  = GREATEST(0, COALESCE(earnings_staking,0)  - LEAST(COALESCE(earnings_staking,0),  round((p_amount * v_st / v_tot)::numeric, 6))),
          earnings_mining   = GREATEST(0, COALESCE(earnings_mining,0)   - LEAST(COALESCE(earnings_mining,0),   round((p_amount * v_mn / v_tot)::numeric, 6))),
          earnings_referral = GREATEST(0, COALESCE(earnings_referral,0) - LEAST(COALESCE(earnings_referral,0), round((p_amount * v_rf / v_tot)::numeric, 6)))
      WHERE user_id = v_user;
    END IF;
  END IF;

  INSERT INTO public.withdrawals(user_id, amount, fee_amount, net_amount, withdrawal_address, withdrawal_type, source, status)
  VALUES (v_user, p_amount, v_fee, v_net, v_address, v_source, v_source, 'pending')
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'withdrawal_id', v_id, 'fee', v_fee, 'net', v_net);
END;
$function$;