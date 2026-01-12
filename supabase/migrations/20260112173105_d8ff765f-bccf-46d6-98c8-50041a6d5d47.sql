-- Create a security definer function to check username availability across all profiles
CREATE OR REPLACE FUNCTION public.is_username_available(check_username text, exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE LOWER(username) = LOWER(check_username)
      AND (exclude_user_id IS NULL OR user_id != exclude_user_id)
  )
$$;