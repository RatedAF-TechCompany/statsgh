-- Create newsroom_runs table to track automated news scanning runs
CREATE TABLE public.newsroom_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'no_news')),
  articles_found INTEGER DEFAULT 0,
  articles_created INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id)
);

-- Create newsroom_articles table to track source articles and their processing status
CREATE TABLE public.newsroom_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.newsroom_runs(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT,
  original_headline TEXT NOT NULL,
  original_summary TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'duplicate')),
  generated_article_id UUID REFERENCES public.articles(id),
  error_message TEXT,
  image_style TEXT CHECK (image_style IN ('investigative-collage', 'ink-watercolour', 'newspaper-ink', 'policy-illustration')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsroom_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for newsroom_runs - only admins/editors can view
CREATE POLICY "Admins and editors can view newsroom runs"
ON public.newsroom_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'editor')
  )
);

CREATE POLICY "Admins and editors can insert newsroom runs"
ON public.newsroom_runs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'editor')
  )
);

CREATE POLICY "Admins and editors can update newsroom runs"
ON public.newsroom_runs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'editor')
  )
);

-- RLS policies for newsroom_articles
CREATE POLICY "Admins and editors can view newsroom articles"
ON public.newsroom_articles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'editor')
  )
);

CREATE POLICY "Admins and editors can insert newsroom articles"
ON public.newsroom_articles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'editor')
  )
);

CREATE POLICY "Admins and editors can update newsroom articles"
ON public.newsroom_articles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'editor')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_newsroom_runs_status ON public.newsroom_runs(status);
CREATE INDEX idx_newsroom_runs_started_at ON public.newsroom_runs(started_at DESC);
CREATE INDEX idx_newsroom_articles_run_id ON public.newsroom_articles(run_id);
CREATE INDEX idx_newsroom_articles_source_url ON public.newsroom_articles(source_url);