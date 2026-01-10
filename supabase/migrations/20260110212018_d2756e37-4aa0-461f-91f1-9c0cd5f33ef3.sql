-- Create ingestion_runs table to track data import operations
CREATE TABLE public.ingestion_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_slug TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('backfill', 'scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add external_key column to data_series for storing PxWeb dimension selections
ALTER TABLE public.data_series
ADD COLUMN IF NOT EXISTS external_key TEXT;

-- Add source_id column to data_series if it doesn't exist
ALTER TABLE public.data_series
ADD COLUMN IF NOT EXISTS source_id UUID;

-- Enable RLS on ingestion_runs
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Only admins and editors can view ingestion runs
CREATE POLICY "Editors can view ingestion runs"
ON public.ingestion_runs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Only system/service role can insert/update ingestion runs (edge functions)
CREATE POLICY "System can manage ingestion runs"
ON public.ingestion_runs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add revision_note column to data_points if it doesn't exist
ALTER TABLE public.data_points
ADD COLUMN IF NOT EXISTS revision_note TEXT;

-- Create index for faster lookups on ingestion_runs
CREATE INDEX idx_ingestion_runs_indicator_slug ON public.ingestion_runs(indicator_slug);
CREATE INDEX idx_ingestion_runs_status ON public.ingestion_runs(status);

-- Create unique constraint on data_points for series_id + date to enable upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'data_points_series_id_date_key'
  ) THEN
    ALTER TABLE public.data_points
    ADD CONSTRAINT data_points_series_id_date_key UNIQUE (series_id, date);
  END IF;
END $$;