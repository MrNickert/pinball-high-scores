-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create scores table
CREATE TABLE public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score BIGINT NOT NULL,
  machine_name TEXT NOT NULL,
  location_name TEXT,
  photo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on scores
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Scores policies
CREATE POLICY "Scores are viewable by everyone" 
ON public.scores FOR SELECT USING (true);

CREATE POLICY "Users can insert their own scores" 
ON public.scores FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores" 
ON public.scores FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scores" 
ON public.scores FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for score photos
INSERT INTO storage.buckets (id, name, public) VALUES ('score-photos', 'score-photos', true);

-- Storage policies for score photos
CREATE POLICY "Score photos are publicly accessible" 
ON storage.objects FOR SELECT USING (bucket_id = 'score-photos');

CREATE POLICY "Users can upload score photos" 
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'score-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own photos" 
ON storage.objects FOR UPDATE USING (
  bucket_id = 'score-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own photos" 
ON storage.objects FOR DELETE USING (
  bucket_id = 'score-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles timestamp
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();