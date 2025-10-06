-- Fix the search_path for prevent_negative_wallet_balance function
CREATE OR REPLACE FUNCTION public.prevent_negative_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.wallet_balance < 0 THEN
    RAISE EXCEPTION 'Wallet balance cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';