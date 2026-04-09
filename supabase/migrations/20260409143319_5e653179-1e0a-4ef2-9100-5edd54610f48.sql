
-- Add breaking news flag and source publication time to articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS is_breaking boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_published_at timestamp with time zone;

-- Create alerts table for source health monitoring
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  source_name text,
  message text NOT NULL,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view alerts" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "Admins can manage alerts" ON public.alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
