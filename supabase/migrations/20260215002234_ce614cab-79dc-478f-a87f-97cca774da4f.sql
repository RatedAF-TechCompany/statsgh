
-- Economic Calendar: upcoming data releases and events
CREATE TABLE public.economic_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'data_release', -- data_release, policy_meeting, budget, other
  indicator_slug TEXT, -- links to indicator if applicable
  source_name TEXT, -- e.g. GSS, BoG, MoF
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- e.g. 'monthly', 'quarterly', 'biannual'
  status TEXT DEFAULT 'upcoming', -- upcoming, released, postponed
  actual_value TEXT, -- filled after release
  previous_value TEXT,
  impact_level TEXT DEFAULT 'medium', -- low, medium, high
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.economic_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view calendar events"
  ON public.economic_calendar FOR SELECT USING (true);

CREATE POLICY "Admins and editors can manage calendar"
  ON public.economic_calendar FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Commodity prices table
CREATE TABLE public.commodity_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commodity TEXT NOT NULL, -- cocoa, gold, oil_brent, oil_wti
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  unit TEXT, -- per_tonne, per_ounce, per_barrel
  change_percent NUMERIC,
  previous_close NUMERIC,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  source TEXT DEFAULT 'free_api',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.commodity_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view commodity prices"
  ON public.commodity_prices FOR SELECT USING (true);

-- Currency rates table
CREATE TABLE public.currency_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT DEFAULT 'USD',
  target_currency TEXT DEFAULT 'GHS',
  rate NUMERIC NOT NULL,
  change_percent NUMERIC,
  previous_rate NUMERIC,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  source TEXT DEFAULT 'free_api',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view currency rates"
  ON public.currency_rates FOR SELECT USING (true);

-- Newsletter tracking
CREATE TABLE public.newsletter_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  subject TEXT NOT NULL,
  recipients_count INTEGER DEFAULT 0,
  top_stories JSONB,
  key_indicators JSONB,
  status TEXT DEFAULT 'sent',
  error_message TEXT
);

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view newsletter sends"
  ON public.newsletter_sends FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Populate economic calendar with known recurring events
INSERT INTO public.economic_calendar (title, description, event_type, indicator_slug, source_name, scheduled_date, is_recurring, recurrence_rule, impact_level) VALUES
  ('CPI Inflation Release', 'Ghana Statistical Service releases monthly Consumer Price Index data', 'data_release', 'cpi-inflation', 'GSS', '2026-03-12 10:00:00+00', true, 'monthly', 'high'),
  ('MPC Rate Decision', 'Bank of Ghana Monetary Policy Committee announces policy rate', 'policy_meeting', 'policy-rate', 'BoG', '2026-03-28 14:00:00+00', true, 'bimonthly', 'high'),
  ('GDP Growth Release', 'GSS releases quarterly GDP growth figures', 'data_release', 'gdp-growth-rate', 'GSS', '2026-03-30 10:00:00+00', true, 'quarterly', 'high'),
  ('Trade Balance Report', 'Bank of Ghana publishes external trade data', 'data_release', 'trade-balance', 'BoG', '2026-03-15 10:00:00+00', true, 'monthly', 'medium'),
  ('Fuel Price Window', 'NPA announces new fuel pricing window', 'data_release', 'fuel-price-petrol', 'NPA', '2026-03-01 06:00:00+00', true, 'biweekly', 'high'),
  ('Foreign Reserves Update', 'BoG publishes gross international reserves', 'data_release', 'foreign-reserves', 'BoG', '2026-03-20 10:00:00+00', true, 'monthly', 'medium'),
  ('Government Budget Review', 'Ministry of Finance mid-year budget review', 'budget', NULL, 'MoF', '2026-07-15 10:00:00+00', true, 'annual', 'high'),
  ('Population Census Data', 'GSS releases updated population estimates', 'data_release', 'population-total', 'GSS', '2026-06-01 10:00:00+00', true, 'annual', 'medium'),
  ('Cocoa Season Opening', 'COCOBOD announces new cocoa season farmgate price', 'other', 'cocoa-production', 'COCOBOD', '2026-10-01 10:00:00+00', true, 'annual', 'high'),
  ('Food Inflation Release', 'GSS publishes food inflation component of CPI', 'data_release', 'food-inflation', 'GSS', '2026-03-12 10:00:00+00', true, 'monthly', 'medium');
