-- Fix the security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles 
WITH (security_invoker = true) AS
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