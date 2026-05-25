
-- 1. Add principal_withdrawn to mining_rentals
ALTER TABLE public.mining_rentals
  ADD COLUMN IF NOT EXISTS principal_withdrawn boolean NOT NULL DEFAULT false;

-- 2. Add mining_rental_id to withdrawals
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS mining_rental_id uuid;

-- 3. Mining yield accrual: stop auto-refunding locked_amount on completion
CREATE OR REPLACE FUNCTION public.accrue_mining_yields()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Principal is NOT returned to mining_wallet anymore.
      -- It becomes withdrawable via the Unlocked Principal section.
      UPDATE public.mining_rentals SET status='completed' WHERE id=r.id;
      v_completed := v_completed + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('credited', v_total_credited, 'completed', v_completed);
END; $function$;

-- 4. Unified principal-withdrawal RPC (stake OR mining)
CREATE OR REPLACE FUNCTION public.request_principal_withdrawal(p_kind text, p_id uuid, p_address text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_kind text;
  v_address text;
  v_amount numeric;
  v_id uuid;
  v_stake record;
  v_rental record;
  v_pending boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_frozen(v_user);

  v_kind := lower(trim(COALESCE(p_kind,'')));
  v_address := trim(COALESCE(p_address,''));
  IF v_kind NOT IN ('stake','mining') THEN RAISE EXCEPTION 'Invalid kind'; END IF;
  IF v_address !~ '^0x[a-fA-F0-9]{40}$' THEN RAISE EXCEPTION 'Address must be a valid BEP-20 (0x...) address'; END IF;

  IF v_kind = 'stake' THEN
    SELECT * INTO v_stake FROM public.stakes WHERE id = p_id AND user_id = v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stake not found'; END IF;
    IF v_stake.end_date > now() THEN RAISE EXCEPTION 'Stake has not ended yet'; END IF;
    IF COALESCE(v_stake.principal_withdrawn,false) THEN RAISE EXCEPTION 'Principal already withdrawn'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.stake_id = p_id AND w.withdrawal_type='principal'
        AND w.status IN ('pending','approved','confirmed','completed')
    ) INTO v_pending;
    IF v_pending THEN RAISE EXCEPTION 'Principal withdrawal already in progress'; END IF;
    v_amount := v_stake.amount;
    INSERT INTO public.withdrawals(user_id, amount, fee_amount, net_amount,
      withdrawal_address, withdrawal_type, source, status, stake_id)
    VALUES (v_user, v_amount, 0, v_amount, v_address, 'principal', 'principal', 'pending', p_id)
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_rental FROM public.mining_rentals WHERE id = p_id AND user_id = v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mining allocation not found'; END IF;
    IF v_rental.ends_at > now() THEN RAISE EXCEPTION 'Mining runtime has not ended yet'; END IF;
    IF COALESCE(v_rental.principal_withdrawn,false) THEN RAISE EXCEPTION 'Principal already withdrawn'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.mining_rental_id = p_id AND w.withdrawal_type='principal'
        AND w.status IN ('pending','approved','confirmed','completed')
    ) INTO v_pending;
    IF v_pending THEN RAISE EXCEPTION 'Principal withdrawal already in progress'; END IF;
    v_amount := v_rental.locked_amount;
    INSERT INTO public.withdrawals(user_id, amount, fee_amount, net_amount,
      withdrawal_address, withdrawal_type, source, status, mining_rental_id)
    VALUES (v_user, v_amount, 0, v_amount, v_address, 'principal', 'principal', 'pending', p_id)
    RETURNING id INTO v_id;
  END IF;

  RETURN json_build_object('success', true, 'withdrawal_id', v_id, 'amount', v_amount);
END;
$function$;

-- 5. Update admin_process_withdrawal: mark principal as withdrawn on approval for both stake & mining
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(p_id uuid, p_action text, p_note text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid action'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  IF p_action='approve' THEN
    UPDATE public.withdrawals SET status='completed', processed_by=auth.uid(), processed_at=now(), admin_notes=p_note WHERE id=p_id;
    IF w.withdrawal_type = 'principal' THEN
      IF w.stake_id IS NOT NULL THEN
        UPDATE public.stakes SET principal_withdrawn=true WHERE id=w.stake_id;
      END IF;
      IF w.mining_rental_id IS NOT NULL THEN
        UPDATE public.mining_rentals SET principal_withdrawn=true WHERE id=w.mining_rental_id;
      END IF;
    END IF;
  ELSE
    UPDATE public.withdrawals SET status='rejected', processed_by=auth.uid(), processed_at=now(), admin_notes=p_note WHERE id=p_id;
    IF w.withdrawal_type <> 'principal' THEN
      IF w.source = 'trading' THEN
        UPDATE public.profiles SET trading_wallet = COALESCE(trading_wallet,0) + w.amount WHERE user_id = w.user_id;
      ELSE
        UPDATE public.profiles SET withdrawable_earnings = COALESCE(withdrawable_earnings,0) + w.amount,
                                    earnings_staking = COALESCE(earnings_staking,0) + w.amount
          WHERE user_id = w.user_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'withdrawal_'||p_action, 'withdrawal', p_id::text, jsonb_build_object('note', p_note));
  RETURN json_build_object('success', true);
END; $function$;
