-- Create enum for rejection reasons
CREATE TYPE public.rejection_reason AS ENUM (
  'score_not_visible',
  'score_mismatch',
  'wrong_machine',
  'photo_unclear',
  'suspected_fake',
  'other'
);

-- Create table for community verification votes
CREATE TABLE public.score_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid REFERENCES public.scores(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  vote text NOT NULL CHECK (vote IN ('approve', 'reject')),
  rejection_reason rejection_reason,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (score_id, user_id)
);

-- Enable RLS
ALTER TABLE public.score_votes ENABLE ROW LEVEL SECURITY;

-- Users can view all votes (for transparency)
CREATE POLICY "Votes are viewable by everyone"
ON public.score_votes
FOR SELECT
USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "Users can insert their own votes"
ON public.score_votes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update their own votes"
ON public.score_votes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
ON public.score_votes
FOR DELETE
USING (auth.uid() = user_id);