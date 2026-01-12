-- Add new columns for onboarding
ALTER TABLE public.profiles 
ADD COLUMN first_name text,
ADD COLUMN last_name text,
ADD COLUMN is_public boolean NOT NULL DEFAULT true,
ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Update the public_profiles view to include new fields
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  username,
  avatar_url,
  first_name,
  last_name,
  is_public,
  created_at,
  updated_at
FROM public.profiles
WHERE is_public = true;