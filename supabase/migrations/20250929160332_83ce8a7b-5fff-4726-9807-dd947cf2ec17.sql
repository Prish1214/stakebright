-- Allow anonymous users to read referral codes for validation during signup
CREATE POLICY "Allow anonymous referral code validation" 
ON public.profiles 
FOR SELECT 
TO anon
USING (true);