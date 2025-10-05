-- Fix withdrawal system - remove wallet_balance deduction
-- Wallet balance should only be for deposits and staking, not withdrawals

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_withdrawal_status_change ON public.withdrawals;
DROP TRIGGER IF EXISTS on_withdrawal_approved ON public.withdrawals;
DROP FUNCTION IF EXISTS public.handle_withdrawal_status_change();
DROP FUNCTION IF EXISTS public.handle_withdrawal_approval();

-- Withdrawals come from earnings tracking, not wallet balance
-- No trigger needed for wallet_balance deduction