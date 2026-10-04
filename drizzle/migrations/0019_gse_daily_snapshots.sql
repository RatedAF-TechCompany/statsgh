CREATE TABLE public.gse_daily_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_date date NOT NULL,
  symbol text NOT NULL,
  name text, sector text,
  close numeric NOT NULL, previous_close numeric, open numeric, last_trade numeric,
  change numeric, change_percent numeric,
  volume bigint, value_traded numeric, year_high numeric, year_low numeric,
  source text NOT NULL, source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_date, symbol)
);
CREATE INDEX ON public.gse_daily_prices (symbol, trade_date DESC);
GRANT SELECT ON public.gse_daily_prices TO anon, authenticated;
GRANT ALL ON public.gse_daily_prices TO service_role;
ALTER TABLE public.gse_daily_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gse prices" ON public.gse_daily_prices FOR SELECT USING (true);

CREATE TABLE public.gse_index_daily (
  trade_date date PRIMARY KEY,
  gse_ci numeric, gse_fsi numeric, volume numeric, market_cap_m numeric,
  source text NOT NULL, source_url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gse_index_daily TO anon, authenticated;
GRANT ALL ON public.gse_index_daily TO service_role;
ALTER TABLE public.gse_index_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gse index" ON public.gse_index_daily FOR SELECT USING (true);

ALTER TABLE public.week_in_numbers ADD COLUMN IF NOT EXISTS gse jsonb;

CREATE OR REPLACE FUNCTION public.compile_gse_week(p_day date DEFAULT ((now() AT TIME ZONE 'UTC'))::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_start date := date_trunc('week', p_day)::date;
  v_end date := v_start + 6;
  v_days int; v_first date; v_last date; v_out jsonb;
BEGIN
  SELECT count(*), min(trade_date), max(trade_date) INTO v_days, v_first, v_last
  FROM gse_index_daily WHERE trade_date BETWEEN v_start AND v_end AND gse_ci IS NOT NULL;
  IF v_days < 2 THEN
    UPDATE week_in_numbers SET gse = NULL WHERE week_start = v_start;
    RETURN 0;
  END IF;
  WITH f AS (SELECT symbol, close FROM gse_daily_prices WHERE trade_date = v_first),
       l AS (SELECT symbol, name, close FROM gse_daily_prices WHERE trade_date = v_last),
       ch AS (SELECT l.symbol, l.name, f.close c0, l.close c1, round((l.close - f.close) / f.close * 100, 2) pct
              FROM l JOIN f USING (symbol) WHERE f.close > 0 AND l.close <> f.close)
  SELECT jsonb_build_object(
    'from', v_first, 'to', v_last, 'trading_days', v_days,
    'ci_start', (SELECT gse_ci FROM gse_index_daily WHERE trade_date = v_first),
    'ci_end', (SELECT gse_ci FROM gse_index_daily WHERE trade_date = v_last),
    'gainers', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM ch WHERE pct > 0 ORDER BY pct DESC LIMIT 3) x), '[]'),
    'losers', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM ch WHERE pct < 0 ORDER BY pct ASC LIMIT 3) x), '[]'),
    'source', 'Ghana Stock Exchange (gse.com.gh), end-of-day', 'source_url', 'https://gse.com.gh/trading-and-data/'
  ) INTO v_out;
  INSERT INTO week_in_numbers(week_start, week_end, items, compiled_at, gse)
  VALUES (v_start, v_end, '[]'::jsonb, now(), v_out)
  ON CONFLICT (week_start) DO UPDATE SET gse = EXCLUDED.gse;
  RETURN v_days;
END $$;