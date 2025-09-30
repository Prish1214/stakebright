-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_deposit_approved ON public.deposits;

-- Create function to handle deposit approval and referral earnings
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
  earning_amount NUMERIC;
BEGIN
  -- Only process if status changed to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- Get the referrer of this user
    SELECT referred_by INTO referrer_id
    FROM public.profiles
    WHERE user_id = NEW.user_id;
    
    -- If user was referred by someone, create referral earning
    IF referrer_id IS NOT NULL THEN
      earning_amount := NEW.amount * 0.05; -- 5% commission
      
      -- Insert referral earning
      INSERT INTO public.referral_earnings (
        referrer_id,
        referred_id,
        deposit_id,
        amount,
        percentage
      ) VALUES (
        referrer_id,
        NEW.user_id,
        NEW.id,
        earning_amount,
        5
      );
      
      -- Update referrer's wallet balance
      UPDATE public.profiles
      SET wallet_balance = wallet_balance + earning_amount
      WHERE user_id = referrer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on deposits table
CREATE TRIGGER on_deposit_approved
  AFTER UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deposit_approval();