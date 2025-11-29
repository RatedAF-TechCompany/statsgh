-- Add categorySlug column to articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS category_slug text;

-- Migrate existing section data to new category slugs
UPDATE public.articles SET category_slug = CASE
  WHEN section = 'Economy & Inflation' THEN 'economy-inflation'
  WHEN section = 'Public Finance & Debt' THEN 'public-finance'
  WHEN section = 'Markets & Banking' THEN 'trade-investment'
  WHEN section = 'Business & Corporates' THEN 'business'
  WHEN section = 'Trade & Investment' THEN 'trade-investment'
  WHEN section = 'Energy & Infrastructure' THEN 'energy-resources'
  WHEN section = 'Households, Jobs & Wages' THEN 'labour-salaries'
  WHEN section = 'Regions & Cities' THEN 'population'
  WHEN section = 'DataLab / Charts' THEN 'charts-explainers'
  WHEN section = 'Opinion & Columns' THEN 'charts-explainers'
  WHEN section = 'Explainers & Guides' THEN 'charts-explainers'
  WHEN section = 'GhanaCrimes' THEN 'ghanacrimes'
  WHEN section = 'Top Stories' THEN 'top-stories'
  ELSE 'business'
END
WHERE category_slug IS NULL;

-- Set NOT NULL constraint after migration
ALTER TABLE public.articles ALTER COLUMN category_slug SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_articles_category_slug ON public.articles(category_slug);

-- Add check constraint for valid category slugs
ALTER TABLE public.articles ADD CONSTRAINT valid_category_slug CHECK (
  category_slug IN (
    'top-stories',
    'economy-inflation',
    'public-finance',
    'labour-salaries',
    'agriculture-food',
    'energy-resources',
    'trade-investment',
    'health-data',
    'education',
    'infrastructure-transport',
    'security-governance',
    'technology-innovation',
    'environment-climate',
    'population',
    'business',
    'charts-explainers',
    'ghanacrimes'
  )
);