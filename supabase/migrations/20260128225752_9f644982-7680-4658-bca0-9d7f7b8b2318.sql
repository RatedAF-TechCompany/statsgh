-- Create table for Ghana Stock Exchange stocks
CREATE TABLE public.gse_stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT,
  current_price NUMERIC NOT NULL DEFAULT 0,
  previous_close NUMERIC,
  price_one_month_ago NUMERIC,
  volume BIGINT DEFAULT 0,
  market_cap NUMERIC,
  change_percent NUMERIC,
  month_change_percent NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gse_stocks ENABLE ROW LEVEL SECURITY;

-- Anyone can view stocks (public dashboard)
CREATE POLICY "Anyone can view GSE stocks"
ON public.gse_stocks
FOR SELECT
USING (true);

-- Only admins/editors can manage stocks
CREATE POLICY "Editors can manage GSE stocks"
ON public.gse_stocks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_gse_stocks_symbol ON public.gse_stocks(symbol);

-- Insert sample GSE stock data (top 10 stocks)
INSERT INTO public.gse_stocks (symbol, name, sector, current_price, previous_close, price_one_month_ago, volume, market_cap, change_percent, month_change_percent) VALUES
('MTN', 'MTN Ghana Ltd', 'Telecommunications', 1.85, 1.82, 1.70, 2500000, 24500000000, 1.65, 8.82),
('GCB', 'GCB Bank Ltd', 'Banking', 6.50, 6.45, 5.90, 850000, 1690000000, 0.78, 10.17),
('GOIL', 'Ghana Oil Company Ltd', 'Oil & Gas', 2.10, 2.08, 1.95, 1200000, 420000000, 0.96, 7.69),
('CAL', 'CAL Bank Ltd', 'Banking', 1.20, 1.18, 1.05, 950000, 720000000, 1.69, 14.29),
('EGH', 'Ecobank Ghana Ltd', 'Banking', 8.50, 8.40, 7.80, 320000, 2125000000, 1.19, 8.97),
('TOTAL', 'TotalEnergies Marketing Ghana', 'Oil & Gas', 4.80, 4.75, 4.50, 180000, 912000000, 1.05, 6.67),
('FML', 'Fan Milk Ltd', 'Food & Beverage', 3.20, 3.15, 3.00, 420000, 640000000, 1.59, 6.67),
('SOGEGH', 'Societe Generale Ghana', 'Banking', 1.05, 1.03, 0.95, 680000, 315000000, 1.94, 10.53),
('RBGH', 'Republic Bank Ghana', 'Banking', 0.45, 0.44, 0.40, 1500000, 270000000, 2.27, 12.50),
('ACCESS', 'Access Bank Ghana', 'Banking', 4.20, 4.15, 3.85, 290000, 1260000000, 1.20, 9.09);

-- Add updated_at trigger
CREATE TRIGGER update_gse_stocks_updated_at
BEFORE UPDATE ON public.gse_stocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();