-- 1. Create a secure RPC function to validate referral codes (returns only boolean)
CREATE OR REPLACE FUNCTION public.validate_referral_code(code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE referral_code = code
  );
$$;

-- 2. Drop the anonymous SELECT policy on profiles table
DROP POLICY IF EXISTS "Allow anonymous referral code validation" ON public.profiles;

-- 3. Update system_settings policy to require authentication
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;

-- Create new policy for authenticated users only
CREATE POLICY "Authenticated users can view system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);