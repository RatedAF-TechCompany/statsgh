-- Add multimedia fields to articles table
ALTER TABLE public.articles 
ADD COLUMN video_url TEXT,
ADD COLUMN audio_url TEXT;