-- Create trigger function to handle withdrawal approval
CREATE OR REPLACE FUNCTION public.handle_withdrawal_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only process if status changed to 'approved' or 'confirmed'
  IF (OLD.status != 'approved' AND NEW.status = 'approved') OR 
     (OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
    
    -- Deduct the withdrawal amount from user's wallet balance
    UPDATE public.profiles
    SET wallet_balance = wallet_balance - NEW.amount
    WHERE user_id = NEW.user_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on withdrawals table
DROP TRIGGER IF EXISTS on_withdrawal_approved ON public.withdrawals;

CREATE TRIGGER on_withdrawal_approved
  AFTER UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_withdrawal_approval();