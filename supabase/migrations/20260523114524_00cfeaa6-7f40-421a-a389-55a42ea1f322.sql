
CREATE OR REPLACE FUNCTION public.get_staking_referral_team()
RETURNS TABLE(user_id uuid, username text, email text, created_at timestamptz, total_deposits numeric, qualified boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.username,
    p.email,
    p.created_at,
    COALESCE((SELECT sum(amount) FROM public.deposits d WHERE d.user_id = p.user_id AND d.status = 'approved'), 0) AS total_deposits,
    COALESCE((SELECT sum(amount) FROM public.deposits d WHERE d.user_id = p.user_id AND d.status = 'approved'), 0) >= 50 AS qualified
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_trading_referral_team()
RETURNS TABLE(user_id uuid, username text, email text, created_at timestamptz, trading_wallet numeric, qualified boolean, trading_level int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.username,
    p.email,
    p.created_at,
    COALESCE(p.trading_wallet, 0) AS trading_wallet,
    COALESCE(p.trading_wallet, 0) >= 100 AS qualified,
    CASE
      WHEN COALESCE(p.trading_wallet,0) >= 30000 THEN 6
      WHEN COALESCE(p.trading_wallet,0) >= 12000 THEN 5
      WHEN COALESCE(p.trading_wallet,0) >= 5000 THEN 4
      WHEN COALESCE(p.trading_wallet,0) >= 1500 THEN 3
      WHEN COALESCE(p.trading_wallet,0) >= 500 THEN 2
      WHEN COALESCE(p.trading_wallet,0) >= 100 THEN 1
      ELSE 0
    END AS trading_level
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC;
$$;
