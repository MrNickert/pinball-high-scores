-- Store last used location on user profile for faster capture flow
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_location_name text,
ADD COLUMN IF NOT EXISTS last_location_lat double precision,
ADD COLUMN IF NOT EXISTS last_location_lon double precision,
ADD COLUMN IF NOT EXISTS last_location_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);