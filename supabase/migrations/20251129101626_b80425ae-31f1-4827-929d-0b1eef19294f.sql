-- Fix incorrect category_slug mappings based on existing section values
UPDATE articles
SET category_slug = CASE
  WHEN section = 'top-stories' THEN 'top-stories'
  WHEN section = 'economy-inflation' THEN 'economy-inflation'
  WHEN section = 'public-finance-debt' THEN 'public-finance'
  WHEN section = 'markets-banking' THEN 'trade-investment'
  WHEN section = 'business-corporates' THEN 'business'
  WHEN section = 'trade-investment' THEN 'trade-investment'
  WHEN section = 'energy-infrastructure' THEN 'energy-resources'
  WHEN section = 'households' THEN 'labour-salaries'
  WHEN section = 'jobs-wages' THEN 'labour-salaries'
  WHEN section = 'regions-cities' THEN 'population'
  WHEN section = 'datalab' THEN 'charts-explainers'
  WHEN section = 'charts' THEN 'charts-explainers'
  WHEN section = 'opinion-columns' THEN 'charts-explainers'
  WHEN section = 'explainers-guides' THEN 'charts-explainers'
  WHEN section = 'ghanacrimes' THEN 'ghanacrimes'
  WHEN section = 'agriculture-food' THEN 'agriculture-food'
  WHEN section = 'health-data' THEN 'health-data'
  WHEN section = 'education' THEN 'education'
  WHEN section = 'infrastructure-transport' THEN 'infrastructure-transport'
  WHEN section = 'security-governance' THEN 'security-governance'
  WHEN section = 'technology-innovation' THEN 'technology-innovation'
  WHEN section = 'environment-climate' THEN 'environment-climate'
  ELSE 'business' -- fallback for unmapped sections
END
WHERE is_published = true;