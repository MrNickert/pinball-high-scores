-- Fix the function search path for cleanup_expired_handoff_codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_handoff_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_handoff_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;