-- Fix security definer view issue by setting proper security
ALTER VIEW public.public_profiles SET (security_invoker = on);