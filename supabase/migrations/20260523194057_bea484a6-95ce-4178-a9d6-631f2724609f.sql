
DROP FUNCTION IF EXISTS public.get_staking_referral_team();
DROP FUNCTION IF EXISTS public.get_trading_referral_team();

CREATE OR REPLACE FUNCTION public.get_staking_referral_team()
 RETURNS TABLE(user_id uuid, username text, created_at timestamp with time zone, total_deposits numeric, qualified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.username,
    p.created_at,
    COALESCE((SELECT sum(amount) FROM public.deposits d WHERE d.user_id = p.user_id AND d.status = 'approved'), 0) AS total_deposits,
    COALESCE((SELECT sum(amount) FROM public.deposits d WHERE d.user_id = p.user_id AND d.status = 'approved'), 0) >= 50 AS qualified
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_trading_referral_team()
 RETURNS TABLE(user_id uuid, username text, created_at timestamp with time zone, qualified boolean, trading_level integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.username,
    p.created_at,
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
$function$;
