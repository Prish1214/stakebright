-- Fix any negative wallet balances
-- Wallet balance should only contain approved deposit amounts, never go negative
UPDATE public.profiles
SET wallet_balance = 0
WHERE wallet_balance < 0;

-- Add a check to prevent future negative wallet balances
CREATE OR REPLACE FUNCTION prevent_negative_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.wallet_balance < 0 THEN
    RAISE EXCEPTION 'Wallet balance cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_wallet_balance ON public.profiles;
CREATE TRIGGER check_wallet_balance
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_negative_wallet_balance();