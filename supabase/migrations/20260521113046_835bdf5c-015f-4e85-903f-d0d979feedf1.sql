
-- Audit log table
CREATE TABLE IF NOT EXISTS public.deposit_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  target_wallet text NOT NULL,
  amount_received numeric NOT NULL,
  amount_credited numeric NOT NULL,
  source text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_credits_user ON public.deposit_credits(user_id);

ALTER TABLE public.deposit_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own deposit credits" ON public.deposit_credits;
CREATE POLICY "Users view own deposit credits"
ON public.deposit_credits FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage deposit credits" ON public.deposit_credits;
CREATE POLICY "Admins manage deposit credits"
ON public.deposit_credits FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Idempotent credit trigger function
CREATE OR REPLACE FUNCTION public.handle_deposit_approved_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted boolean := false;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved')
     OR (TG_OP = 'INSERT' AND NEW.status = 'approved') THEN

    -- Idempotency guard: unique on deposit_id prevents double credit
    BEGIN
      INSERT INTO public.deposit_credits (
        deposit_id, user_id, target_wallet, amount_received, amount_credited, source, notes
      ) VALUES (
        NEW.id, NEW.user_id, NEW.target_wallet, NEW.amount, NEW.amount,
        TG_NAME || ' / handle_deposit_approved_balance',
        'Auto-credit on approval'
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
      ELSE
        UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance,0) + NEW.amount WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill audit log for already-approved deposits so history is complete
INSERT INTO public.deposit_credits (deposit_id, user_id, target_wallet, amount_received, amount_credited, source, notes)
SELECT id, user_id, COALESCE(target_wallet,'main'), amount, amount, 'backfill', 'Historical approved deposit'
FROM public.deposits
WHERE status = 'approved'
ON CONFLICT (deposit_id) DO NOTHING;
