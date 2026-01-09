-- Drop and recreate the public_profiles view with SECURITY INVOKER = FALSE
-- This allows the view to bypass RLS on the profiles table for public read access
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles 
WITH (security_invoker = false)
AS 
SELECT 
    id,
    user_id,
    username,
    avatar_url,
    created_at,
    updated_at
FROM profiles;

-- Grant SELECT access to authenticated and anon users
GRANT SELECT ON public_profiles TO authenticated;
GRANT SELECT ON public_profiles TO anon;