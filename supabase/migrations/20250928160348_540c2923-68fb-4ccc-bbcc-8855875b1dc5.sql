-- Fix security warnings by setting search_path for the functions
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

-- Fix the daily staking earnings function
CREATE OR REPLACE FUNCTION public.add_daily_staking_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stake_record RECORD;
  daily_earning NUMERIC;
BEGIN
  -- Process all active stakes
  FOR stake_record IN 
    SELECT s.*, sp.daily_return_rate 
    FROM public.stakes s
    JOIN public.staking_plans sp ON s.plan_id = sp.id
    WHERE s.is_active = true 
    AND s.end_date > NOW()
  LOOP
    -- Calculate daily earning
    daily_earning := stake_record.amount * (stake_record.daily_return_rate / 100);
    
    -- Update total earned for the stake
    UPDATE public.stakes
    SET total_earned = total_earned + daily_earning
    WHERE id = stake_record.id;
    
    -- Update user's wallet balance with daily earning
    UPDATE public.profiles
    SET wallet_balance = wallet_balance + daily_earning
    WHERE user_id = stake_record.user_id;
  END LOOP;
END;
$$;