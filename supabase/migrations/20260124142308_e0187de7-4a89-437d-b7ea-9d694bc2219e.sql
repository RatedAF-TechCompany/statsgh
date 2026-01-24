-- Add opinion category
INSERT INTO public.categories (name, slug, description, color)
VALUES ('Opinion', 'opinion', 'Opinion columns and commentary from Ghana', '#6366f1')
ON CONFLICT (slug) DO NOTHING;