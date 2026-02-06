
-- BoG Dashboard Scanner: scan runs
CREATE TABLE public.bog_scan_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_time_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'running',
  notes TEXT,
  items_scanned INT DEFAULT 0,
  items_qualifying INT DEFAULT 0,
  indicators_refreshed INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BoG Dashboard Scanner: individual scan items
CREATE TABLE public.bog_scan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.bog_scan_runs(id) ON DELETE CASCADE,
  bog_url TEXT NOT NULL,
  title TEXT NOT NULL,
  published_date TEXT,
  detected_topics TEXT[] DEFAULT '{}',
  qualifies BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  dedupe_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index on dedupe_hash for fast lookups
CREATE UNIQUE INDEX idx_bog_scan_items_dedupe ON public.bog_scan_items(dedupe_hash);

-- Dashboard updates from free APIs
CREATE TABLE public.dashboard_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.bog_scan_runs(id) ON DELETE SET NULL,
  indicator_key TEXT NOT NULL,
  period TEXT,
  value NUMERIC,
  unit TEXT,
  source TEXT NOT NULL DEFAULT 'WorldBank',
  source_detail TEXT,
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique on indicator_key + period for upsert
CREATE UNIQUE INDEX idx_dashboard_updates_key_period ON public.dashboard_updates(indicator_key, period);

-- Enable RLS on all tables
ALTER TABLE public.bog_scan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bog_scan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_updates ENABLE ROW LEVEL SECURITY;

-- Public read access (these are public data tables)
CREATE POLICY "Anyone can read bog_scan_runs" ON public.bog_scan_runs FOR SELECT USING (true);
CREATE POLICY "Anyone can read bog_scan_items" ON public.bog_scan_items FOR SELECT USING (true);
CREATE POLICY "Anyone can read dashboard_updates" ON public.dashboard_updates FOR SELECT USING (true);

-- Service role (edge functions) can insert/update
CREATE POLICY "Service can manage bog_scan_runs" ON public.bog_scan_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage bog_scan_items" ON public.bog_scan_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service can manage dashboard_updates" ON public.dashboard_updates FOR ALL USING (true) WITH CHECK (true);
