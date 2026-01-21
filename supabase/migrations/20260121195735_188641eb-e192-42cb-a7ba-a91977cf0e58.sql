-- Add meta_title column for SEO-optimized titles
ALTER TABLE public.articles 
ADD COLUMN meta_title text;