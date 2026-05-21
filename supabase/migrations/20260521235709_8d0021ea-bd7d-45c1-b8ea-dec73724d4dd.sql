
-- Mining rentals table
CREATE TABLE public.mining_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  coin TEXT NOT NULL CHECK (coin IN ('BTC','LTC','DOGE')),
  tier TEXT NOT NULL CHECK (tier IN ('Basic','Pro','Elite')),
  locked_amount NUMERIC NOT NULL,
  runtime_days INTEGER NOT NULL,
  daily_min_pct NUMERIC NOT NULL,
  daily_max_pct NUMERIC NOT NULL,
  efficiency NUMERIC NOT NULL DEFAULT 95,
  hashrate NUMERIC NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  last_yield_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_yield NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mining_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rentals" ON public.mining_rentals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rentals" ON public.mining_rentals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rentals" ON public.mining_rentals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage rentals" ON public.mining_rentals FOR ALL USING (has_role(auth.uid(),'admin'));

CREATE INDEX idx_mining_rentals_user_status ON public.mining_rentals(user_id, status);
CREATE INDEX idx_mining_rentals_active ON public.mining_rentals(status, ends_at) WHERE status = 'active';

-- Start a rental
CREATE OR REPLACE FUNCTION public.start_mining_rental(p_coin TEXT, p_tier TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_price NUMERIC; v_days INT; v_min NUMERIC; v_max NUMERIC; v_eff NUMERIC; v_hash NUMERIC;
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_coin NOT IN ('BTC','LTC','DOGE') THEN RAISE EXCEPTION 'Invalid coin'; END IF;
  IF p_tier NOT IN ('Basic','Pro','Elite') THEN RAISE EXCEPTION 'Invalid tier'; END IF;

  -- Pricing matrix
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

-- Accrue daily yields + auto-unlock principal
CREATE OR REPLACE FUNCTION public.accrue_mining_yields()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_days_due INT;
  v_yield NUMERIC;
  v_total_credited NUMERIC := 0;
  v_completed INT := 0;
  v_pct NUMERIC;
  v_cap_time TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT * FROM public.mining_rentals WHERE status='active' FOR UPDATE
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
        SET wallet_balance = COALESCE(wallet_balance,0) + v_yield
        WHERE user_id = r.user_id;

      v_total_credited := v_total_credited + v_yield;
    END IF;

    -- Complete if runtime ended
    IF now() >= r.ends_at THEN
      UPDATE public.mining_rentals SET status='completed' WHERE id=r.id;
      UPDATE public.profiles SET mining_wallet = mining_wallet + r.locked_amount WHERE user_id = r.user_id;
      v_completed := v_completed + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('credited', v_total_credited, 'completed', v_completed);
END; $$;

-- Hourly cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('accrue-mining-yields-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'accrue-mining-yields-hourly',
  '0 * * * *',
  $$ SELECT public.accrue_mining_yields(); $$
);
