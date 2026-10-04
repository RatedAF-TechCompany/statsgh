CREATE TABLE public.macro_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_key text NOT NULL,
  period date NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  is_projection boolean NOT NULL DEFAULT false,
  source text NOT NULL,
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_key, period)
);
GRANT SELECT ON public.macro_series TO anon, authenticated;
GRANT ALL ON public.macro_series TO service_role;
ALTER TABLE public.macro_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read macro series" ON public.macro_series FOR SELECT USING (true);

ALTER TABLE public.economic_calendar
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS date_precision text NOT NULL DEFAULT 'exact';
CREATE UNIQUE INDEX IF NOT EXISTS economic_calendar_external_id_key ON public.economic_calendar (external_id);
COMMENT ON COLUMN public.economic_calendar.source_url IS 'Public calendar shows only entries with a source_url';