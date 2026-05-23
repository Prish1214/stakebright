CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users_7d', (SELECT count(*) FROM public.profiles WHERE last_login_at > now() - interval '7 days'),
    'frozen_users', (SELECT count(*) FROM public.profiles WHERE is_frozen = true),
    'total_deposits', COALESCE((SELECT sum(amount) FROM public.deposits WHERE status='approved'), 0),
    'pending_deposits', (SELECT count(*) FROM public.deposits WHERE status='pending'),
    'total_withdrawals', COALESCE((SELECT sum(amount) FROM public.withdrawals WHERE status IN ('completed','approved')), 0),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawals WHERE status='pending'),
    'total_locked_stakes', COALESCE((SELECT sum(amount) FROM public.stakes WHERE is_active=true), 0),
    'total_locked_mining', COALESCE((SELECT sum(locked_amount) FROM public.mining_rentals WHERE status='active'), 0),
    'total_wallet_balance', COALESCE((SELECT sum(coalesce(withdrawable_earnings,0)+coalesce(staking_wallet,0)+coalesce(mining_wallet,0)+coalesce(trading_wallet,0)) FROM public.profiles), 0),
    'active_staking_users', (SELECT count(DISTINCT user_id) FROM public.stakes WHERE is_active=true),
    'active_trading_users_24h', (SELECT count(DISTINCT user_id) FROM public.trading_sessions WHERE status='scalp' AND started_at > now() - interval '24 hours'),
    'active_mining_allocations', (SELECT count(*) FROM public.mining_rentals WHERE status='active'),
    'total_referral_earnings', COALESCE((SELECT sum(amount) FROM public.referral_earnings), 0),
    'total_staking_earnings', COALESCE((SELECT sum(total_earned) FROM public.stakes), 0),
    'total_mining_yield', COALESCE((SELECT sum(total_yield) FROM public.mining_rentals), 0)
  ) INTO result;
  RETURN result;
END;
$$;