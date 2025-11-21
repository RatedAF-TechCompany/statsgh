-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  color text DEFAULT '#262626',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create media library table
CREATE TABLE IF NOT EXISTS public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  url text NOT NULL,
  alt_text text,
  size integer,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id),
  tags text[],
  created_at timestamptz DEFAULT now()
);

-- Create article versions table for auto-save and version history
CREATE TABLE IF NOT EXISTS public.article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  version_number integer NOT NULL,
  is_autosave boolean DEFAULT false,
  saved_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create site settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text DEFAULT 'STATS GH',
  footer_text text,
  logo_url text,
  favicon_url text,
  default_seo_description text,
  social_image_url text,
  theme_colors jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Create article views table for analytics
CREATE TABLE IF NOT EXISTS public.article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  user_agent text,
  referrer text,
  device_type text
);

-- Add new fields to articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Anyone can view categories" ON public.categories 
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.categories 
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for media
CREATE POLICY "Anyone can view media" ON public.media 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload media" ON public.media 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own media" ON public.media 
  FOR UPDATE USING (auth.uid() = uploaded_by);

CREATE POLICY "Admins can delete media" ON public.media 
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for article_versions
CREATE POLICY "Admins can view all versions" ON public.article_versions 
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create versions" ON public.article_versions 
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for site_settings
CREATE POLICY "Anyone can view settings" ON public.site_settings 
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.site_settings 
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for article_views
CREATE POLICY "Anyone can insert views" ON public.article_views 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view analytics" ON public.article_views 
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Storage policies for media bucket
CREATE POLICY "Anyone can view media files" ON storage.objects 
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own media" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete media" ON storage.objects 
  FOR DELETE USING (bucket_id = 'media' AND has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.categories (name, slug, color, description) VALUES
  ('Markets', 'markets', '#262626', 'Financial markets and trading news'),
  ('Politics', 'politics', '#6f6a63', 'Political news and analysis'),
  ('Technology', 'technology', '#262626', 'Tech industry and innovation'),
  ('Business', 'business', '#6f6a63', 'Business and corporate news'),
  ('World', 'world', '#262626', 'International news and events')
ON CONFLICT (name) DO NOTHING;

-- Insert default site settings
INSERT INTO public.site_settings (site_name, footer_text, default_seo_description)
VALUES ('STATS GH', 'ft.com', 'Your trusted source for news and analysis')
ON CONFLICT DO NOTHING;