-- Update handle_new_user function to properly handle referral codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referrer_user_id UUID;
BEGIN
  -- Get referrer's user_id if referral code was provided
  IF NEW.raw_user_meta_data->>'referralCode' IS NOT NULL THEN
    SELECT user_id INTO referrer_user_id
    FROM public.profiles
    WHERE referral_code = NEW.raw_user_meta_data->>'referralCode';
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (user_id, email, username, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    referrer_user_id
  );
  
  -- Assign user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;