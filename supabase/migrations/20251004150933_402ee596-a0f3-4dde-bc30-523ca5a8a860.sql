-- Fix wallet balance to only show approved deposit amounts for staking

-- First, create a trigger to add approved deposits to wallet balance
CREATE OR REPLACE FUNCTION public.handle_deposit_approved_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process if status changed to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- Add deposit amount to user's wallet balance
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + NEW.amount
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_deposit_approved_balance ON public.deposits;

-- Create trigger for deposit approval
CREATE TRIGGER on_deposit_approved_balance
  AFTER UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deposit_approved_balance();

-- Update the referral earning trigger to NOT update wallet_balance
CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referrer_id UUID;
  earning_amount NUMERIC;
  first_deposit BOOLEAN;
  existing_referral_earning UUID;
BEGIN
  -- Only process if status changed to 'approved'
  IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
    
    -- Check if referral earning already exists for this deposit
    SELECT id INTO existing_referral_earning
    FROM public.referral_earnings
    WHERE deposit_id = NEW.id;
    
    -- Only create referral earning if it doesn't exist yet
    IF existing_referral_earning IS NULL THEN
      -- Check if this is the user's first approved deposit
      SELECT NOT EXISTS (
        SELECT 1 FROM public.deposits
        WHERE user_id = NEW.user_id
        AND status = 'approved'
        AND id != NEW.id
      ) INTO first_deposit;
      
      -- Only proceed if this is the first deposit
      IF first_deposit THEN
        -- Get the referrer of this user
        SELECT referred_by INTO referrer_id
        FROM public.profiles
        WHERE user_id = NEW.user_id;
        
        -- If user was referred by someone, create referral earning
        IF referrer_id IS NOT NULL THEN
          earning_amount := NEW.amount * 0.05; -- 5% commission
          
          -- Insert referral earning (but don't update wallet_balance)
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
          
          -- DO NOT update wallet_balance - referral earnings are separate
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update the process_daily_staking_returns to NOT update wallet_balance
CREATE OR REPLACE FUNCTION public.process_daily_staking_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stake_record RECORD;
  daily_earning NUMERIC;
BEGIN
  FOR stake_record IN 
    SELECT id, user_id, daily_return, end_date, total_earned
    FROM public.stakes
    WHERE is_active = true
    AND end_date > now()
  LOOP
    daily_earning := stake_record.daily_return;
    
    -- Update the stake's total earned
    UPDATE public.stakes
    SET total_earned = total_earned + daily_earning
    WHERE id = stake_record.id;
    
    -- DO NOT update wallet_balance - earnings are tracked in stakes.total_earned
    
    -- If stake has reached end date, mark as inactive
    IF stake_record.end_date <= now() THEN
      UPDATE public.stakes
      SET is_active = false
      WHERE id = stake_record.id;
    END IF;
  END LOOP;
END;
$function$;