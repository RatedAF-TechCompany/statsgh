-- Add social media fields to articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS twitter_post TEXT,
ADD COLUMN IF NOT EXISTS instagram_comment TEXT,
ADD COLUMN IF NOT EXISTS instagram_compressed TEXT;