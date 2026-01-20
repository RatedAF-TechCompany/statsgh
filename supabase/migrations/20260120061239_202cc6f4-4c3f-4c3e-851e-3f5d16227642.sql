-- Remove the rigid category_slug check constraint
ALTER TABLE articles DROP CONSTRAINT IF EXISTS valid_category_slug;

-- Add a foreign key relationship instead (optional validation through categories table)
-- First ensure all existing category_slugs have matching categories
INSERT INTO categories (name, slug, description, color)
SELECT DISTINCT 
  INITCAP(REPLACE(category_slug, '-', ' ')) as name,
  category_slug as slug,
  'Auto-created category' as description,
  '#262626' as color
FROM articles 
WHERE category_slug IS NOT NULL 
  AND category_slug NOT IN (SELECT slug FROM categories)
ON CONFLICT (slug) DO NOTHING;