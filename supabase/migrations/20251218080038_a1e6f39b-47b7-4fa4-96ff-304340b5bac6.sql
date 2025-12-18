-- Drop and recreate the function with SECURITY DEFINER to bypass RLS
DROP FUNCTION IF EXISTS public.validate_referral_code(text);

CREATE OR REPLACE FUNCTION public.validate_referral_code(code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE referral_code = code
  );
$$;