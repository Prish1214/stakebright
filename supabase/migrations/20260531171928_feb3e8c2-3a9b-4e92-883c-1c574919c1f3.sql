
CREATE TABLE public.transak_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transak_order_id text UNIQUE,
  partner_order_id text UNIQUE NOT NULL,
  target_wallet text NOT NULL CHECK (target_wallet IN ('staking','trading','mining')),
  inr_amount numeric NOT NULL,
  usdt_amount numeric,
  conversion_rate numeric,
  status text NOT NULL DEFAULT 'pending',
  credited boolean NOT NULL DEFAULT false,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.transak_orders TO authenticated;
GRANT ALL ON public.transak_orders TO service_role;

ALTER TABLE public.transak_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transak orders"
  ON public.transak_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transak orders"
  ON public.transak_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage transak orders"
  ON public.transak_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_transak_orders_updated_at
  BEFORE UPDATE ON public.transak_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Credit USDT to selected wallet on Transak completion (service-role only via edge function)
CREATE OR REPLACE FUNCTION public.credit_transak_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
BEGIN
  SELECT * INTO o FROM public.transak_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.credited THEN
    RETURN json_build_object('success', true, 'already_credited', true);
  END IF;
  IF o.usdt_amount IS NULL OR o.usdt_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid USDT amount';
  END IF;

  IF o.target_wallet = 'staking' THEN
    UPDATE public.profiles SET staking_wallet = COALESCE(staking_wallet,0) + o.usdt_amount WHERE user_id = o.user_id;
  ELSIF o.target_wallet = 'trading' THEN
    UPDATE public.profiles SET trading_wallet = COALESCE(trading_wallet,0) + o.usdt_amount WHERE user_id = o.user_id;
  ELSIF o.target_wallet = 'mining' THEN
    UPDATE public.profiles SET mining_wallet = COALESCE(mining_wallet,0) + o.usdt_amount WHERE user_id = o.user_id;
  END IF;

  UPDATE public.transak_orders SET credited = true, status = 'completed' WHERE id = p_order_id;

  -- Trigger referral activation bonus when funding staking (mirrors deposit flow)
  IF o.target_wallet = 'staking' THEN
    PERFORM public.grant_staking_referral_activation_bonus(o.user_id, o.usdt_amount, NULL);
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
