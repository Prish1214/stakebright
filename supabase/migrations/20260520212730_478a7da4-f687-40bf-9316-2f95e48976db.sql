-- Add wallet target and network columns
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS target_wallet text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'bep20';

ALTER TABLE public.deposits
  ADD CONSTRAINT deposits_target_wallet_check
  CHECK (target_wallet IN ('main','staking','trading','mining'));

ALTER TABLE public.deposits
  ADD CONSTRAINT deposits_network_check
  CHECK (network IN ('bep20','trc20','upi'));

-- Replace credit logic: route to the chosen wallet
CREATE OR REPLACE FUNCTION public.handle_deposit_approved_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved')
     OR (TG_OP = 'INSERT' AND NEW.status = 'approved') THEN

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deposits_credit_wallet ON public.deposits;
CREATE TRIGGER trg_deposits_credit_wallet
AFTER INSERT OR UPDATE OF status ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.handle_deposit_approved_balance();

-- Make the legacy RPC a no-op so the webhook doesn't double-credit
CREATE OR REPLACE FUNCTION public.update_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Crediting is handled by trg_deposits_credit_wallet based on target_wallet.
  RETURN;
END;
$$;