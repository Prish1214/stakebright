-- Add withdrawal_address column to withdrawals table
ALTER TABLE public.withdrawals 
ADD COLUMN withdrawal_address TEXT NOT NULL DEFAULT '';