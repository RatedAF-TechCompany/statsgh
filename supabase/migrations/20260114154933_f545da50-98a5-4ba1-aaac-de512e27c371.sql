-- Add dedupe_key and category_hint columns for duplicate prevention

-- Add dedupe_key to newsroom_articles (for tracking processed stories)
ALTER TABLE public.newsroom_articles 
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Add category_hint to newsroom_articles (from AI classification)
ALTER TABLE public.newsroom_articles 
ADD COLUMN IF NOT EXISTS category_hint TEXT;

-- Add dedupe_key to articles (for cross-run duplicate prevention)
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Create indexes for efficient duplicate lookups
CREATE INDEX IF NOT EXISTS idx_newsroom_articles_dedupe_key 
ON public.newsroom_articles(dedupe_key) 
WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_dedupe_key 
ON public.articles(dedupe_key) 
WHERE dedupe_key IS NOT NULL;