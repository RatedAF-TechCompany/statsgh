-- Create newsroom_sources table for source health monitoring
CREATE TABLE public.newsroom_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  rss_url text NOT NULL,
  fallback_rss_url text,
  is_active boolean DEFAULT true,
  last_success_at timestamp with time zone,
  last_item_at timestamp with time zone,
  last_error_at timestamp with time zone,
  last_error_message text,
  consecutive_errors integer DEFAULT 0,
  total_items_seen integer DEFAULT 0,
  total_items_accepted integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create newsroom_candidates table for audit trail
CREATE TABLE public.newsroom_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid REFERENCES public.newsroom_runs(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text,
  headline text NOT NULL,
  rss_summary text,
  fetched_full_text text,
  pub_date_raw text,
  pub_date_parsed timestamp with time zone,
  decision text NOT NULL DEFAULT 'pending', -- accepted, rejected, needs_review, error
  rejection_code text, -- OUTSIDE_TIME_WINDOW, NO_NUMBERS_IN_SOURCE, CRIME_FILTER, POLITICAL_GOSSIP, DEDUPED, AI_JSON_INVALID, IMAGE_FETCH_FAILED, PUBDATE_PARSE_FAILED, NOT_BUSINESS, RSS_FETCH_FAILED
  rejection_detail text,
  dedupe_key text,
  dedupe_matched_article_id uuid REFERENCES public.articles(id),
  dedupe_matched_candidate_id uuid REFERENCES public.newsroom_candidates(id),
  dedupe_similarity_evidence jsonb,
  numbers_found text[],
  newsroom_article_id uuid REFERENCES public.newsroom_articles(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsroom_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsroom_candidates ENABLE ROW LEVEL SECURITY;

-- RLS policies for newsroom_sources
CREATE POLICY "Admins and editors can view newsroom sources"
  ON public.newsroom_sources FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'editor'::app_role])
  ));

CREATE POLICY "Admins and editors can manage newsroom sources"
  ON public.newsroom_sources FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'editor'::app_role])
  ));

-- RLS policies for newsroom_candidates
CREATE POLICY "Admins and editors can view newsroom candidates"
  ON public.newsroom_candidates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'editor'::app_role])
  ));

CREATE POLICY "Admins and editors can insert newsroom candidates"
  ON public.newsroom_candidates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'editor'::app_role])
  ));

-- Create indexes for efficient queries
CREATE INDEX idx_newsroom_candidates_run_id ON public.newsroom_candidates(run_id);
CREATE INDEX idx_newsroom_candidates_decision ON public.newsroom_candidates(decision);
CREATE INDEX idx_newsroom_candidates_rejection_code ON public.newsroom_candidates(rejection_code);
CREATE INDEX idx_newsroom_candidates_headline_search ON public.newsroom_candidates USING gin(to_tsvector('english', headline));
CREATE INDEX idx_newsroom_candidates_source_url ON public.newsroom_candidates(source_url);
CREATE INDEX idx_newsroom_sources_name ON public.newsroom_sources(name);

-- Add needs_review status to newsroom_articles
ALTER TABLE public.newsroom_articles 
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS review_reason text;

-- Insert initial sources based on current RSS_SOURCES list
INSERT INTO public.newsroom_sources (name, rss_url) VALUES
  ('BusinessDayGh', 'https://www.businessdayghana.com/feed/'),
  ('GhanaBizNews', 'https://www.ghanabusinessnews.com/feed/'),
  ('GhanaNEWS', 'https://ghananews.com/feed'),
  ('PulseGhanaBiz', 'https://www.pulse.com.gh/bi/rss'),
  ('GraphicBiz', 'https://www.graphic.com.gh/business/feed'),
  ('GraphicEcon', 'https://www.graphic.com.gh/business/business-news/feed'),
  ('GhanaWebBiz', 'https://www.ghanaweb.com/GhanaHomePage/business/rss.xml'),
  ('ModernGhana', 'https://www.modernghana.com/rss/business'),
  ('YenBiz', 'https://yen.com.gh/rss/category/business'),
  ('JoyBiz', 'https://www.myjoyonline.com/business/feed/'),
  ('CitiBiz', 'https://citinewsroom.com/category/business/feed/'),
  ('BFTOnline', 'https://thebftonline.com/feed/'),
  ('GhanaReport', 'https://www.theghanareport.com/feed/'),
  ('3News', 'https://3news.com/category/business/feed/'),
  ('GNA', 'https://gna.org.gh/feed/'),
  ('GNABusiness', 'https://gna.org.gh/category/business/feed/'),
  ('DailyGuide', 'https://dailyguidenetwork.com/feed/'),
  ('PeaceFM', 'https://www.peacefmonline.com/pages/business/rss.xml'),
  ('AdomBiz', 'https://www.adomonline.com/business/feed/'),
  ('StarrFM', 'https://starrfm.com.gh/category/business/feed/'),
  ('GhanaianTimes', 'https://www.ghanaiantimes.com.gh/feed/'),
  ('CediTalk', 'https://ceditalk.com/feed/'),
  ('GoldStreet', 'https://goldstreetbusiness.com/feed/')
ON CONFLICT (name) DO NOTHING;