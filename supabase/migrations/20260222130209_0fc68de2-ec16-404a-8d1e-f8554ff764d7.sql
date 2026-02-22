
-- Tweet Scheduler Module: Isolated tables

-- Table: tweet_bank_items
CREATE TABLE public.tweet_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  hash text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tweet_bank_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tweet bank items"
  ON public.tweet_bank_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view tweet bank items"
  ON public.tweet_bank_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_tweet_bank_items_updated_at
  BEFORE UPDATE ON public.tweet_bank_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: tweet_scheduler_state (single-row config)
CREATE TABLE public.tweet_scheduler_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_enabled boolean NOT NULL DEFAULT true,
  quiet_start text NOT NULL DEFAULT '23:00',
  quiet_end text NOT NULL DEFAULT '06:00',
  timezone text NOT NULL DEFAULT 'Africa/Accra',
  cycle_id text NOT NULL DEFAULT gen_random_uuid()::text,
  posted_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  queue_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_posted_at timestamptz,
  last_posted_hash text,
  last_error_at timestamptz,
  fail_count_24h integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tweet_scheduler_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tweet scheduler state"
  ON public.tweet_scheduler_state FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view tweet scheduler state"
  ON public.tweet_scheduler_state FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_tweet_scheduler_state_updated_at
  BEFORE UPDATE ON public.tweet_scheduler_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the single row
INSERT INTO public.tweet_scheduler_state (id) VALUES (1);

-- Table: tweet_scheduler_logs
CREATE TABLE public.tweet_scheduler_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  tweet_text text,
  category text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  reason text,
  tweet_id text,
  cycle_id text,
  error_message text
);

ALTER TABLE public.tweet_scheduler_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tweet scheduler logs"
  ON public.tweet_scheduler_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view tweet scheduler logs"
  ON public.tweet_scheduler_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
