-- Add language and unit preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'nl')),
ADD COLUMN use_metric boolean NOT NULL DEFAULT true;