
-- ============ PROFILE ADDITIONS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_ip text;

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage announcements"
  ON public.announcements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at >= now())
  );

-- ============ ADMIN ACTIVITY LOGS ============
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read activity logs"
  ON public.admin_activity_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert activity logs"
  ON public.admin_activity_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ LOGIN EVENTS ============
CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own login events"
  ON public.login_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all login events"
  ON public.login_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own login events"
  ON public.login_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_login_events_user ON public.login_events(user_id, created_at DESC);

-- ============ FUNCTIONS ============

-- log_login_event: any authenticated user records their login
CREATE OR REPLACE FUNCTION public.log_login_event(p_ip text, p_ua text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.login_events(user_id, ip, user_agent) VALUES (v_uid, p_ip, p_ua);
  UPDATE public.profiles SET last_login_at = now(), last_login_ip = p_ip WHERE user_id = v_uid;
END;
$$;

-- admin_stats: dashboard KPIs
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users_7d', (SELECT count(*) FROM public.profiles WHERE last_login_at > now() - interval '7 days'),
    'frozen_users', (SELECT count(*) FROM public.profiles WHERE is_frozen = true),
    'total_deposits', COALESCE((SELECT sum(amount) FROM public.deposits WHERE status='approved'), 0),
    'pending_deposits', (SELECT count(*) FROM public.deposits WHERE status='pending'),
    'total_withdrawals', COALESCE((SELECT sum(amount) FROM public.withdrawals WHERE status IN ('completed','approved')), 0),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawals WHERE status='pending'),
    'total_locked_stakes', COALESCE((SELECT sum(amount) FROM public.stakes WHERE is_active=true), 0),
    'total_locked_mining', COALESCE((SELECT sum(locked_amount) FROM public.mining_rentals WHERE status='active'), 0),
    'total_wallet_balance', COALESCE((SELECT sum(coalesce(wallet_balance,0)+coalesce(staking_wallet,0)+coalesce(mining_wallet,0)+coalesce(trading_wallet,0)) FROM public.profiles), 0),
    'active_staking_users', (SELECT count(DISTINCT user_id) FROM public.stakes WHERE is_active=true),
    'active_trading_users_24h', (SELECT count(DISTINCT user_id) FROM public.trading_sessions WHERE status='scalp' AND started_at > now() - interval '24 hours'),
    'active_mining_allocations', (SELECT count(*) FROM public.mining_rentals WHERE status='active'),
    'total_referral_earnings', COALESCE((SELECT sum(amount) FROM public.referral_earnings), 0),
    'total_staking_earnings', COALESCE((SELECT sum(total_earned) FROM public.stakes), 0),
    'total_mining_yield', COALESCE((SELECT sum(total_yield) FROM public.mining_rentals), 0)
  ) INTO result;
  RETURN result;
END;
$$;

-- admin_adjust_balance
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user_id uuid, p_wallet text, p_delta numeric, p_note text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_wallet NOT IN ('main','staking','mining','trading') THEN RAISE EXCEPTION 'Invalid wallet'; END IF;

  IF p_wallet='main' THEN UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance,0)+p_delta WHERE user_id=p_user_id;
  ELSIF p_wallet='staking' THEN UPDATE public.profiles SET staking_wallet = COALESCE(staking_wallet,0)+p_delta WHERE user_id=p_user_id;
  ELSIF p_wallet='mining' THEN UPDATE public.profiles SET mining_wallet = COALESCE(mining_wallet,0)+p_delta WHERE user_id=p_user_id;
  ELSIF p_wallet='trading' THEN UPDATE public.profiles SET trading_wallet = COALESCE(trading_wallet,0)+p_delta WHERE user_id=p_user_id;
  END IF;

  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'adjust_balance', 'user', p_user_id::text,
          jsonb_build_object('wallet', p_wallet, 'delta', p_delta, 'note', p_note));
  RETURN json_build_object('success', true);
END; $$;

-- admin_credit_reward (alias of adjust positive)
CREATE OR REPLACE FUNCTION public.admin_credit_reward(p_user_id uuid, p_wallet text, p_amount numeric, p_note text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  PERFORM public.admin_adjust_balance(p_user_id, p_wallet, p_amount, COALESCE(p_note,'manual reward'));
  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'credit_reward', 'user', p_user_id::text,
          jsonb_build_object('wallet', p_wallet, 'amount', p_amount, 'note', p_note));
  RETURN json_build_object('success', true);
END; $$;

-- admin_process_withdrawal
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(p_id uuid, p_action text, p_note text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    -- Refund net+fee back to main wallet (since withdrawals come from earnings)
    UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance,0) + w.amount WHERE user_id = w.user_id;
  END IF;

  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'withdrawal_'||p_action, 'withdrawal', p_id::text, jsonb_build_object('note', p_note));
  RETURN json_build_object('success', true);
END; $$;

-- admin_update_deposit_status
CREATE OR REPLACE FUNCTION public.admin_update_deposit_status(p_id uuid, p_status text, p_note text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.deposits SET status=p_status, admin_notes=p_note, approved_by=auth.uid(), approved_at=now() WHERE id=p_id;
  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'deposit_'||p_status, 'deposit', p_id::text, jsonb_build_object('note', p_note));
  RETURN json_build_object('success', true);
END; $$;

-- admin_set_setting
CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.system_settings(setting_key, setting_value, updated_by, updated_at)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value, updated_by=auth.uid(), updated_at=now();
  INSERT INTO public.admin_activity_logs(admin_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'set_setting', 'setting', p_key, jsonb_build_object('value', p_value));
  RETURN json_build_object('success', true);
END; $$;

-- Ensure unique key for upsert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='system_settings_setting_key_key') THEN
    BEGIN
      ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_setting_key_key UNIQUE(setting_key);
    EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END $$;

-- admin_top_referrers
CREATE OR REPLACE FUNCTION public.admin_top_referrers(p_limit int DEFAULT 20)
RETURNS TABLE(user_id uuid, email text, username text, referral_code text, qualified_count int, total_earnings numeric)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.user_id, p.email, p.username, p.referral_code,
    (SELECT count(*)::int FROM public.profiles c WHERE c.referred_by = p.user_id) AS qualified_count,
    COALESCE((SELECT sum(amount) FROM public.referral_earnings re WHERE re.referrer_id = p.user_id), 0) AS total_earnings
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY total_earnings DESC, qualified_count DESC
  LIMIT p_limit;
$$;

-- admin_daily_growth
CREATE OR REPLACE FUNCTION public.admin_daily_growth(p_days int DEFAULT 30)
RETURNS TABLE(day date, signups int, deposits numeric, withdrawals numeric)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (
    SELECT generate_series((now() - (p_days||' days')::interval)::date, now()::date, '1 day')::date AS day
  )
  SELECT d.day,
    COALESCE((SELECT count(*)::int FROM public.profiles p WHERE p.created_at::date = d.day), 0) AS signups,
    COALESCE((SELECT sum(amount) FROM public.deposits dep WHERE dep.created_at::date = d.day AND dep.status='approved'), 0) AS deposits,
    COALESCE((SELECT sum(amount) FROM public.withdrawals w WHERE w.created_at::date = d.day AND w.status IN ('completed','approved')), 0) AS withdrawals
  FROM d
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY d.day;
$$;

-- Seed freeze flags
INSERT INTO public.system_settings(setting_key, setting_value, description)
VALUES
  ('freeze_staking','false','Freeze staking section'),
  ('freeze_mining','false','Freeze mining section'),
  ('freeze_trading','false','Freeze trading section'),
  ('freeze_withdrawals','false','Freeze withdrawals')
ON CONFLICT (setting_key) DO NOTHING;
