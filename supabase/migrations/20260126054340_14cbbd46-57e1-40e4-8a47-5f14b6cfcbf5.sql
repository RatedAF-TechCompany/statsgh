-- Create the Fertility Rate indicator
INSERT INTO public.indicators (
  name,
  slug,
  short_name,
  description,
  definition,
  unit,
  unit_display,
  frequency,
  is_ghana_core,
  priority_tier,
  chart_type,
  decimal_places,
  show_change
) VALUES (
  'Total Fertility Rate',
  'fertility-rate',
  'Fertility Rate',
  'Average number of children a woman would have over her lifetime if current fertility patterns remained constant',
  'The total fertility rate (TFR) represents the number of children that would be born to a woman if she were to live to the end of her childbearing years and bear children in accordance with age-specific fertility rates of the specified year.',
  'births per woman',
  'births',
  'annual',
  true,
  'tier1',
  'line',
  1,
  true
);

-- Get the Ghana geography ID and create a data series for fertility rate
INSERT INTO public.data_series (
  indicator_id,
  geography_id,
  is_primary,
  name
)
SELECT 
  i.id,
  g.id,
  true,
  'Ghana - Total Fertility Rate'
FROM indicators i
CROSS JOIN geographies g
WHERE i.slug = 'fertility-rate'
AND g.is_ghana = true
LIMIT 1;

-- Insert the 2022 DHS data point (3.9 births per woman)
INSERT INTO public.data_points (
  series_id,
  date,
  value,
  value_formatted,
  source_note
)
SELECT 
  ds.id,
  '2022-01-01'::date,
  3.9,
  '3.9',
  '2022 Ghana Demographic and Health Survey'
FROM data_series ds
JOIN indicators i ON ds.indicator_id = i.id
WHERE i.slug = 'fertility-rate'
AND ds.is_primary = true
LIMIT 1;