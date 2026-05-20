-- Subtract one duplicate amount per approved deposit from the wallet it was credited to
WITH dups AS (
  SELECT user_id, target_wallet, SUM(amount) AS dup_amount
  FROM public.deposits
  WHERE status = 'approved'
  GROUP BY user_id, target_wallet
)
UPDATE public.profiles p SET
  staking_wallet = GREATEST(0, COALESCE(staking_wallet,0) - COALESCE((SELECT dup_amount FROM dups WHERE dups.user_id=p.user_id AND dups.target_wallet='staking'),0)),
  trading_wallet = GREATEST(0, COALESCE(trading_wallet,0) - COALESCE((SELECT dup_amount FROM dups WHERE dups.user_id=p.user_id AND dups.target_wallet='trading'),0)),
  mining_wallet  = GREATEST(0, COALESCE(mining_wallet,0)  - COALESCE((SELECT dup_amount FROM dups WHERE dups.user_id=p.user_id AND dups.target_wallet='mining'),0)),
  wallet_balance = GREATEST(0, COALESCE(wallet_balance,0) - COALESCE((SELECT dup_amount FROM dups WHERE dups.user_id=p.user_id AND dups.target_wallet='main'),0))
WHERE p.user_id IN (SELECT user_id FROM dups);