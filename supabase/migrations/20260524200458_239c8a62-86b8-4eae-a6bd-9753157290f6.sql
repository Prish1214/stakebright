
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_withdrawal_type_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_withdrawal_type_check
  CHECK (withdrawal_type = ANY (ARRAY['earnings'::text, 'trading'::text, 'principal'::text]));

UPDATE public.profiles
SET withdrawable_earnings = GREATEST(
  COALESCE(withdrawable_earnings,0),
  COALESCE(earnings_staking,0) + COALESCE(earnings_mining,0) + COALESCE(earnings_referral,0)
);
