-- Fix withdrawal trigger to NOT deduct from wallet_balance
-- Wallet balance should only be for deposits and staking, not withdrawals
DROP TRIGGER IF EXISTS on_withdrawal_approved ON public.withdrawals;
DROP FUNCTION IF EXISTS public.handle_withdrawal_approval();

-- Create new trigger that does NOT touch wallet_balance
-- Withdrawals come from earnings, not wallet balance
CREATE OR REPLACE FUNCTION public.handle_withdrawal_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only update processed_at timestamp when status changes to approved/confirmed/completed
  IF (OLD.status != NEW.status AND NEW.status IN ('approved', 'confirmed', 'completed')) THEN
    NEW.processed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_withdrawal_status_change
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.handle_withdrawal_status_change();