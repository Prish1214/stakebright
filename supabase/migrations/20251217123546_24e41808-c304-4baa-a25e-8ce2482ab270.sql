CREATE OR REPLACE FUNCTION public.handle_deposit_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referrer_id UUID;
  has_active_stake BOOLEAN;
  has_approved_deposit BOOLEAN;
  earning_amount NUMERIC;
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
      -- Get the referrer of this user
      SELECT referred_by INTO referrer_id
      FROM public.profiles
      WHERE user_id = NEW.user_id;
      
      -- If user was referred by someone, check if referrer qualifies
      IF referrer_id IS NOT NULL THEN
        -- Check if referrer has at least one active stake
        SELECT EXISTS (
          SELECT 1 FROM public.stakes
          WHERE user_id = referrer_id
          AND is_active = true
        ) INTO has_active_stake;
        
        -- Check if referrer has at least one approved deposit
        SELECT EXISTS (
          SELECT 1 FROM public.deposits
          WHERE user_id = referrer_id
          AND status = 'approved'
        ) INTO has_approved_deposit;
        
        -- Only create referral earning if referrer has active stake OR approved deposit
        IF has_active_stake OR has_approved_deposit THEN
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
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;