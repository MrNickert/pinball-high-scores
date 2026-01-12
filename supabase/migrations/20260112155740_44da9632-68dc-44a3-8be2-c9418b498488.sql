-- Add notification preference columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notify_score_updates boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_friend_activity boolean NOT NULL DEFAULT true;