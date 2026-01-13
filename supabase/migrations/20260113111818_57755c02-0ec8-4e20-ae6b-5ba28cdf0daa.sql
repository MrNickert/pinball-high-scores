-- Create table for auth handoff codes (for PWA magic link flow)
CREATE TABLE public.auth_handoff_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(6) NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_auth_handoff_codes_code ON public.auth_handoff_codes(code);

-- Create index for cleanup of expired codes
CREATE INDEX idx_auth_handoff_codes_expires_at ON public.auth_handoff_codes(expires_at);

-- Enable RLS
ALTER TABLE public.auth_handoff_codes ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - this table is only accessed by edge functions with service role key
-- The codes are one-time use and expire after 5 minutes

-- Create a function to clean up expired codes (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_handoff_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.auth_handoff_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;