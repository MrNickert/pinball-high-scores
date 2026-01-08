-- Fix migration: Postgres doesn't support CREATE POLICY IF NOT EXISTS

-- 1) Add last_location_id (id from PinballMap) to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_location_id integer;

-- 2) Remove public-read policies on profiles (if present)
DROP POLICY IF EXISTS "Users can view public profile data" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- 3) Ensure RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) Only owner can SELECT their profile row (includes last_location_* fields)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- 5) Public safe view for usernames/avatars
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  user_id,
  username,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

ALTER VIEW public.public_profiles SET (security_invoker = on);

-- 6) Privileges
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);