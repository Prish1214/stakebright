
-- 1) Referred users profile leak: drop overly broad SELECT policy, expose safe RPC
DROP POLICY IF EXISTS "Users can view referred users profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_my_referred_users()
RETURNS TABLE(user_id uuid, username text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.created_at
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_referred_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_referred_users() TO authenticated;

-- 2) Referral earnings: block client inserts (SECURITY DEFINER triggers still work)
DROP POLICY IF EXISTS "System can create referral earnings" ON public.referral_earnings;
CREATE POLICY "Block client inserts on referral_earnings"
  ON public.referral_earnings FOR INSERT
  TO public
  WITH CHECK (false);

-- 3) system_settings: restrict reads to a known allow-list of public keys
DROP POLICY IF EXISTS "Authenticated users can view system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can view public system settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (setting_key IN (
    'withdrawal_fee_percentage',
    'minimum_withdrawal',
    'referral_percentage',
    'deposit_address',
    'freeze_staking',
    'freeze_mining',
    'freeze_trading',
    'freeze_withdrawals'
  ));

-- 4) user_roles: restrictive policy preventing non-admins from writing
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles AS RESTRICTIVE FOR INSERT
  TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles AS RESTRICTIVE FOR DELETE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
