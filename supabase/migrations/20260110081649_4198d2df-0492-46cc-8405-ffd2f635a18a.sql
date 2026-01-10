-- =====================================================
-- STATSGH DATA PLATFORM - CORE SCHEMA
-- Phase 1: Indicators, Series, Sources, Datasets, Geographies
-- =====================================================

-- 1. GEOGRAPHIES (Ghana-first hierarchy)
CREATE TABLE public.geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE, -- GH, GH-AA (Ashanti), etc.
  type TEXT NOT NULL CHECK (type IN ('country', 'region', 'district', 'aggregate')),
  parent_id UUID REFERENCES public.geographies(id),
  iso_alpha2 TEXT,
  iso_alpha3 TEXT,
  is_ghana BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert Ghana as default + regions
INSERT INTO public.geographies (name, code, type, is_ghana, display_order) VALUES
  ('Ghana', 'GH', 'country', true, 0),
  ('World', 'WORLD', 'aggregate', false, 1000),
  ('Sub-Saharan Africa', 'SSA', 'aggregate', false, 999);

-- Ghana regions (will reference Ghana as parent after insert)
WITH ghana AS (SELECT id FROM public.geographies WHERE code = 'GH')
INSERT INTO public.geographies (name, code, type, parent_id, is_ghana, display_order)
SELECT name, code, 'region', ghana.id, true, row_number() OVER ()
FROM ghana, (VALUES
  ('Greater Accra', 'GH-AA'),
  ('Ashanti', 'GH-AH'),
  ('Western', 'GH-WP'),
  ('Eastern', 'GH-EP'),
  ('Central', 'GH-CP'),
  ('Northern', 'GH-NP'),
  ('Volta', 'GH-TV'),
  ('Upper East', 'GH-UE'),
  ('Upper West', 'GH-UW'),
  ('Brong-Ahafo', 'GH-BA'),
  ('Western North', 'GH-WN'),
  ('Ahafo', 'GH-AF'),
  ('Bono East', 'GH-BE'),
  ('Oti', 'GH-OT'),
  ('North East', 'GH-NE'),
  ('Savannah', 'GH-SV')
) AS regions(name, code);

-- Geography sets for grouping
CREATE TABLE public.geography_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('ghana_regions', 'ghana_districts', 'peers', 'custom')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.geography_set_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_set_id UUID NOT NULL REFERENCES public.geography_sets(id) ON DELETE CASCADE,
  geography_id UUID NOT NULL REFERENCES public.geographies(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(geography_set_id, geography_id)
);

-- 2. DATA SOURCES (GSS, BoG, MoF, etc.)
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  source_type TEXT CHECK (source_type IN ('government', 'international', 'academic', 'private', 'ngo')),
  country_id UUID REFERENCES public.geographies(id),
  website_url TEXT,
  logo_url TEXT,
  is_ghana_source BOOLEAN DEFAULT false,
  reliability_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert core Ghana sources
INSERT INTO public.data_sources (name, short_name, source_type, is_ghana_source, website_url) VALUES
  ('Ghana Statistical Service', 'GSS', 'government', true, 'https://statsghana.gov.gh'),
  ('Bank of Ghana', 'BoG', 'government', true, 'https://bog.gov.gh'),
  ('Ministry of Finance', 'MoF', 'government', true, 'https://mofep.gov.gh'),
  ('Ghana Cocoa Board', 'COCOBOD', 'government', true, 'https://cocobod.gh'),
  ('Ghana Revenue Authority', 'GRA', 'government', true, 'https://gra.gov.gh'),
  ('Energy Commission', 'EC', 'government', true, 'https://energycom.gov.gh'),
  ('National Petroleum Authority', 'NPA', 'government', true, 'https://npa.gov.gh'),
  ('Ghana Health Service', 'GHS', 'government', true, 'https://ghs.gov.gh'),
  ('Electoral Commission', 'EC-Ghana', 'government', true, 'https://ec.gov.gh'),
  ('World Bank', 'WB', 'international', false, 'https://data.worldbank.org'),
  ('IMF', 'IMF', 'international', false, 'https://imf.org'),
  ('African Development Bank', 'AfDB', 'international', false, 'https://afdb.org');

-- 3. TOPICS (Ghana-first topic areas)
CREATE TABLE public.data_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#1a365d',
  display_order INTEGER DEFAULT 0,
  parent_id UUID REFERENCES public.data_topics(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert primary topics
INSERT INTO public.data_topics (name, slug, description, display_order) VALUES
  ('Finance and Macroeconomy', 'finance-macroeconomy', 'GDP, growth, fiscal policy, and macroeconomic indicators', 1),
  ('Prices and Cost of Living', 'prices-cost-living', 'Inflation, CPI, and cost of living indicators', 2),
  ('Government Budget and Public Debt', 'budget-debt', 'Revenue, expenditure, deficits, and public debt', 3),
  ('Currency, Trade and External Sector', 'trade-external', 'Exchange rates, exports, imports, and balance of payments', 4),
  ('Banking and Credit', 'banking-credit', 'Banking sector, credit growth, and financial stability', 5),
  ('Agriculture and Food', 'agriculture-food', 'Crop production, food security, and agricultural trade', 6),
  ('Energy and Fuel', 'energy-fuel', 'Electricity, oil, gas, and fuel prices', 7),
  ('Jobs and Wages', 'jobs-wages', 'Employment, unemployment, and wage data', 8),
  ('Population and Migration', 'population-migration', 'Demographics, urbanization, and migration', 9),
  ('Health', 'health', 'Health outcomes, disease burden, and healthcare access', 10),
  ('Education', 'education', 'Enrollment, literacy, and education quality', 11),
  ('Housing and Living Standards', 'housing-living', 'Housing, utilities, and quality of life', 12),
  ('Business and Industry', 'business-industry', 'Industrial production and business activity', 13),
  ('Environment and Climate', 'environment-climate', 'Climate data, emissions, and environmental indicators', 14),
  ('Transport and Infrastructure', 'transport-infrastructure', 'Roads, ports, and transport systems', 15),
  ('Crime and Safety', 'crime-safety', 'Crime statistics and public safety', 16),
  ('Governance and Elections', 'governance-elections', 'Electoral data and governance indicators', 17);

-- 4. INDICATORS (core measurement definitions)
CREATE TABLE public.indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_name TEXT,
  description TEXT,
  definition TEXT, -- Technical definition
  methodology TEXT, -- How it's calculated
  caveats TEXT, -- Limitations and notes
  unit TEXT NOT NULL, -- %, GHS, USD, tonnes, etc.
  unit_display TEXT, -- How to display the unit
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'irregular')),
  topic_id UUID REFERENCES public.data_topics(id),
  priority_tier TEXT CHECK (priority_tier IN ('tier1', 'tier2', 'tier3')) DEFAULT 'tier2',
  is_ghana_core BOOLEAN DEFAULT false,
  default_geography_id UUID REFERENCES public.geographies(id),
  chart_type TEXT DEFAULT 'line' CHECK (chart_type IN ('line', 'bar', 'area', 'scatter')),
  decimal_places INTEGER DEFAULT 2,
  show_change BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DATASETS (collections of data from sources)
CREATE TABLE public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  source_id UUID NOT NULL REFERENCES public.data_sources(id),
  source_url TEXT, -- Direct link to source dataset
  source_document TEXT, -- PDF/report name
  last_updated_at TIMESTAMPTZ,
  update_frequency TEXT,
  license TEXT,
  coverage_start DATE,
  coverage_end DATE,
  is_ghana_dataset BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. DATA SERIES (specific series within indicators)
CREATE TABLE public.data_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  geography_id UUID NOT NULL REFERENCES public.geographies(id),
  dataset_id UUID REFERENCES public.datasets(id),
  name TEXT, -- Optional override name
  breakdown_type TEXT, -- 'national', 'regional', 'urban_rural', 'gender', etc.
  breakdown_value TEXT, -- e.g., 'urban', 'male', specific commodity
  is_primary BOOLEAN DEFAULT false, -- Is this the main series for the indicator?
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(indicator_id, geography_id, breakdown_type, breakdown_value)
);

-- 7. DATA POINTS (actual values)
CREATE TABLE public.data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.data_series(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value NUMERIC NOT NULL,
  value_formatted TEXT, -- Pre-formatted display value
  source_id UUID REFERENCES public.data_sources(id),
  source_note TEXT, -- Specific citation
  is_estimate BOOLEAN DEFAULT false,
  is_provisional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(series_id, date)
);

-- 8. INDICATOR-TOPIC MAPPING (many-to-many)
CREATE TABLE public.indicator_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.data_topics(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(indicator_id, topic_id)
);

-- 9. ARTICLE-INDICATOR LINKING (newsroom integration)
CREATE TABLE public.article_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  cited_value NUMERIC,
  cited_date DATE,
  cited_geography_id UUID REFERENCES public.geographies(id),
  context_note TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, indicator_id, cited_date)
);

-- 10. ARTICLE-SOURCE LINKING
CREATE TABLE public.article_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  citation_text TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, source_id)
);

-- 11. GHANA SERIES TAGS (for filtering Ghana data)
CREATE TABLE public.ghana_series_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.data_series(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (tag IN ('national', 'regional', 'district', 'urban', 'rural', 'male', 'female', 'commodity', 'sector')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(series_id, tag)
);

-- 12. DATA IMPORTS (track CSV uploads)
CREATE TABLE public.data_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  rows_total INTEGER,
  rows_imported INTEGER,
  rows_failed INTEGER,
  error_log JSONB,
  imported_by UUID REFERENCES auth.users(id),
  indicator_id UUID REFERENCES public.indicators(id),
  dataset_id UUID REFERENCES public.datasets(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_geographies_type ON public.geographies(type);
CREATE INDEX idx_geographies_is_ghana ON public.geographies(is_ghana);
CREATE INDEX idx_geographies_parent ON public.geographies(parent_id);

CREATE INDEX idx_data_sources_ghana ON public.data_sources(is_ghana_source);
CREATE INDEX idx_data_sources_type ON public.data_sources(source_type);

CREATE INDEX idx_indicators_topic ON public.indicators(topic_id);
CREATE INDEX idx_indicators_priority ON public.indicators(priority_tier);
CREATE INDEX idx_indicators_ghana_core ON public.indicators(is_ghana_core);
CREATE INDEX idx_indicators_slug ON public.indicators(slug);

CREATE INDEX idx_data_series_indicator ON public.data_series(indicator_id);
CREATE INDEX idx_data_series_geography ON public.data_series(geography_id);
CREATE INDEX idx_data_series_dataset ON public.data_series(dataset_id);

CREATE INDEX idx_data_points_series ON public.data_points(series_id);
CREATE INDEX idx_data_points_date ON public.data_points(date);
CREATE INDEX idx_data_points_series_date ON public.data_points(series_id, date DESC);

CREATE INDEX idx_article_indicators_article ON public.article_indicators(article_id);
CREATE INDEX idx_article_indicators_indicator ON public.article_indicators(indicator_id);

CREATE INDEX idx_datasets_source ON public.datasets(source_id);
CREATE INDEX idx_datasets_ghana ON public.datasets(is_ghana_dataset);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.geographies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geography_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geography_set_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghana_series_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ for reference data
CREATE POLICY "Anyone can view geographies" ON public.geographies FOR SELECT USING (true);
CREATE POLICY "Anyone can view geography sets" ON public.geography_sets FOR SELECT USING (true);
CREATE POLICY "Anyone can view geography set members" ON public.geography_set_members FOR SELECT USING (true);
CREATE POLICY "Anyone can view data sources" ON public.data_sources FOR SELECT USING (true);
CREATE POLICY "Anyone can view topics" ON public.data_topics FOR SELECT USING (true);
CREATE POLICY "Anyone can view indicators" ON public.indicators FOR SELECT USING (true);
CREATE POLICY "Anyone can view datasets" ON public.datasets FOR SELECT USING (true);
CREATE POLICY "Anyone can view data series" ON public.data_series FOR SELECT USING (true);
CREATE POLICY "Anyone can view data points" ON public.data_points FOR SELECT USING (true);
CREATE POLICY "Anyone can view indicator topics" ON public.indicator_topics FOR SELECT USING (true);
CREATE POLICY "Anyone can view article indicators" ON public.article_indicators FOR SELECT USING (true);
CREATE POLICY "Anyone can view article sources" ON public.article_sources FOR SELECT USING (true);
CREATE POLICY "Anyone can view ghana series tags" ON public.ghana_series_tags FOR SELECT USING (true);

-- ADMIN/EDITOR WRITE access
CREATE POLICY "Admins can manage geographies" ON public.geographies FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage geography sets" ON public.geography_sets FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage geography set members" ON public.geography_set_members FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage data sources" ON public.data_sources FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage topics" ON public.data_topics FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can manage indicators" ON public.indicators FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage datasets" ON public.datasets FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage data series" ON public.data_series FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage data points" ON public.data_points FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage indicator topics" ON public.indicator_topics FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage article indicators" ON public.article_indicators FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage article sources" ON public.article_sources FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage ghana series tags" ON public.ghana_series_tags FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can view data imports" ON public.data_imports FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can manage data imports" ON public.data_imports FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'editor'));

-- Updated at triggers
CREATE TRIGGER update_geographies_updated_at BEFORE UPDATE ON public.geographies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_topics_updated_at BEFORE UPDATE ON public.data_topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_indicators_updated_at BEFORE UPDATE ON public.indicators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_series_updated_at BEFORE UPDATE ON public.data_series FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_points_updated_at BEFORE UPDATE ON public.data_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();