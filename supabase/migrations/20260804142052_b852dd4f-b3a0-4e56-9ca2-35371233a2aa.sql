-- Make referral code validation tolerant of case and whitespace at signup
CREATE OR REPLACE FUNCTION public.validate_referral_code(code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(referral_code) = lower(btrim(code))
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_user_id UUID;
  v_code TEXT;
BEGIN
  v_code := btrim(COALESCE(NEW.raw_user_meta_data->>'referralCode', ''));

  IF v_code <> '' THEN
    SELECT user_id INTO referrer_user_id
    FROM public.profiles
    WHERE lower(referral_code) = lower(v_code)
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, email, username, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1)),
    referrer_user_id
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;