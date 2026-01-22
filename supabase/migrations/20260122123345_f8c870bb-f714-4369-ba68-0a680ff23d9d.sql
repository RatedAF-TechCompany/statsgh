-- Add is_wire column to articles table to identify fast-published content
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS is_wire BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient wire article queries
CREATE INDEX IF NOT EXISTS idx_articles_is_wire ON public.articles(is_wire) WHERE is_wire = true;

-- Add comment for documentation
COMMENT ON COLUMN public.articles.is_wire IS 'True for articles from fast-publish sources (wire service content)';