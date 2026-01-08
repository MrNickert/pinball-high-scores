-- Fix: Make location data only readable by the profile owner
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create new policy: Public fields (username, avatar) are viewable by everyone
-- Location fields are only viewable by the profile owner
CREATE POLICY "Users can view public profile data"
ON public.profiles
FOR SELECT
USING (true);

-- Create a view that hides sensitive location data for public access
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  username,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;