-- Recalculate all wallet balances to only include approved deposits minus staked amounts

-- First, reset all wallet balances to 0
UPDATE public.profiles
SET wallet_balance = 0;

-- Add approved deposit amounts to wallet balances
UPDATE public.profiles p
SET wallet_balance = COALESCE((
  SELECT SUM(d.amount)
  FROM public.deposits d
  WHERE d.user_id = p.user_id
  AND d.status = 'approved'
), 0);

-- Subtract amounts that are currently in active stakes
UPDATE public.profiles p
SET wallet_balance = wallet_balance - COALESCE((
  SELECT SUM(s.amount)
  FROM public.stakes s
  WHERE s.user_id = p.user_id
  AND s.is_active = true
), 0);