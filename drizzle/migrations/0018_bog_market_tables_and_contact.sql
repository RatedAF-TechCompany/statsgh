CREATE TABLE public.bog_fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  currency text NOT NULL,
  pair text NOT NULL,
  buying numeric, selling numeric, mid numeric NOT NULL,
  source_name text NOT NULL DEFAULT 'Bank of Ghana',
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_date, pair)
);
CREATE TABLE public.bog_tbill_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date date NOT NULL,
  tender_no text,
  tenor_days int NOT NULL,
  discount_rate numeric, interest_rate numeric NOT NULL,
  source_name text NOT NULL DEFAULT 'Bank of Ghana',
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_date, tenor_days)
);
CREATE TABLE public.bog_policy_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_no int NOT NULL UNIQUE,
  mpc_dates text,
  effective_date date NOT NULL,
  rate numeric NOT NULL,
  source_name text NOT NULL DEFAULT 'Bank of Ghana',
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bog_interbank_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL UNIQUE,
  rate numeric NOT NULL,
  source_name text NOT NULL DEFAULT 'Bank of Ghana',
  source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.market_scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper text NOT NULL,
  status text NOT NULL,
  rows_upserted int NOT NULL DEFAULT 0,
  error text,
  ran_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'contact' CHECK (kind IN ('contact','advertise')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  organisation text CHECK (organisation IS NULL OR char_length(organisation) <= 150),
  subject text CHECK (subject IS NULL OR char_length(subject) <= 150),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bog_fx_rates, public.bog_tbill_rates, public.bog_policy_rates, public.bog_interbank_rates TO anon, authenticated;
GRANT ALL ON public.bog_fx_rates, public.bog_tbill_rates, public.bog_policy_rates, public.bog_interbank_rates, public.market_scrape_runs, public.contact_messages TO service_role;
GRANT SELECT ON public.market_scrape_runs TO authenticated;
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT ON public.contact_messages TO authenticated;

ALTER TABLE public.bog_fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bog_tbill_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bog_policy_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bog_interbank_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.bog_fx_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read" ON public.bog_tbill_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read" ON public.bog_policy_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read" ON public.bog_interbank_rates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins read" ON public.market_scrape_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone can send" ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX ON public.bog_fx_rates (pair, rate_date DESC);
CREATE INDEX ON public.bog_tbill_rates (tenor_days, issue_date DESC);