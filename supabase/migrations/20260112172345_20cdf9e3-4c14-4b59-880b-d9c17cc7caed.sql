-- Add unique constraint to username column
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);