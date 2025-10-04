-- Fix the handle_deposit_approval trigger to prevent duplicate referral earnings
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;