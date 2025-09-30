-- Allow users to view profiles of users they have referred
CREATE POLICY "Users can view referred users profiles" 
ON public.profiles 
FOR SELECT 
USING (referred_by = auth.uid());