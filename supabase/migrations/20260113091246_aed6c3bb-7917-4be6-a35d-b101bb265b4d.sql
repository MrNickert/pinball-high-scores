-- Create table for locally-added machines pending Pinball Map approval
CREATE TABLE public.local_machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id INTEGER NOT NULL,
  location_name TEXT NOT NULL,
  machine_id INTEGER NOT NULL,
  machine_name TEXT NOT NULL,
  manufacturer TEXT,
  year INTEGER,
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.local_machines ENABLE ROW LEVEL SECURITY;

-- Anyone can view local machines (to show them in the list)
CREATE POLICY "Anyone can view local machines"
ON public.local_machines
FOR SELECT
USING (true);

-- Authenticated users can add machines
CREATE POLICY "Authenticated users can add local machines"
ON public.local_machines
FOR INSERT
WITH CHECK (auth.uid() = added_by);

-- Create index for faster lookups by location
CREATE INDEX idx_local_machines_location_id ON public.local_machines(location_id);