-- Add word_count column to articles table
ALTER TABLE public.articles ADD COLUMN word_count integer;

-- Backfill existing articles with word count
UPDATE public.articles 
SET word_count = array_length(regexp_split_to_array(regexp_replace(body, '<[^>]*>', ' ', 'g'), '\s+'), 1)
WHERE body IS NOT NULL;