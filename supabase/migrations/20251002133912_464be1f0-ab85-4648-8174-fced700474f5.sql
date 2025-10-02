
-- First, delete duplicate referral earnings, keeping only the first one for each deposit
DELETE FROM public.referral_earnings
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY deposit_id ORDER BY created_at ASC) as rn
    FROM public.referral_earnings
  ) t
  WHERE t.rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.referral_earnings
ADD CONSTRAINT unique_deposit_referral UNIQUE (deposit_id);

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_deposit_approval ON public.deposits;

-- Create the trigger to handle deposit approvals
CREATE TRIGGER on_deposit_approval
  AFTER UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deposit_approval();

-- Also need to fix the wallet balances that were doubled
-- Deduct the duplicate amounts from referrers who received double payments
UPDATE public.profiles
SET wallet_balance = wallet_balance - sub.duplicate_amount
FROM (
  SELECT referrer_id, SUM(amount) as duplicate_amount
  FROM (
    SELECT referrer_id, amount,
           ROW_NUMBER() OVER (PARTITION BY deposit_id ORDER BY created_at ASC) as rn
    FROM public.referral_earnings
    WHERE deposit_id IN (
      SELECT deposit_id
      FROM public.referral_earnings
      GROUP BY deposit_id
      HAVING COUNT(*) > 1
    )
  ) duplicates
  WHERE rn > 1
  GROUP BY referrer_id
) sub
WHERE profiles.user_id = sub.referrer_id;
