-- Add fast_publish_backfill to allowed trigger types
ALTER TABLE public.newsroom_runs DROP CONSTRAINT newsroom_runs_trigger_type_check;
ALTER TABLE public.newsroom_runs ADD CONSTRAINT newsroom_runs_trigger_type_check CHECK (trigger_type = ANY (ARRAY['manual'::text, 'scheduled'::text, 'fast_publish_backfill'::text]));