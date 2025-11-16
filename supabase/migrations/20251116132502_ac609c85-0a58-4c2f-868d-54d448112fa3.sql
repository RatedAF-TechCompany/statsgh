-- Add is_most_read column to articles table
ALTER TABLE public.articles 
ADD COLUMN is_most_read BOOLEAN NOT NULL DEFAULT false;