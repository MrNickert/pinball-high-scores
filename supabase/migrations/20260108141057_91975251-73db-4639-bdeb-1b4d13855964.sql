-- Add column to track if user was notified about validation
ALTER TABLE public.scores 
ADD COLUMN user_notified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;