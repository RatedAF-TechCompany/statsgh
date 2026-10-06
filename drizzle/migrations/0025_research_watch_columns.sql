ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS skip_auto_tweet boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS research_scope text;