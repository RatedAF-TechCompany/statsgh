CREATE OR REPLACE FUNCTION public.notify_site_revalidate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_published IS TRUE AND (
       TG_OP = 'INSERT'
       OR OLD.is_published IS DISTINCT FROM NEW.is_published
       OR OLD.title IS DISTINCT FROM NEW.title
       OR OLD.body IS DISTINCT FROM NEW.body
       OR OLD.summary IS DISTINCT FROM NEW.summary
       OR OLD.hero_image_url IS DISTINCT FROM NEW.hero_image_url
       OR OLD.category_slug IS DISTINCT FROM NEW.category_slug
       OR OLD.slug IS DISTINCT FROM NEW.slug) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://www.statsgh.com/api/revalidate',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('id', NEW.id),
        timeout_milliseconds := 5000);
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'site revalidate failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_site_revalidate() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS articles_site_revalidate ON public.articles;
CREATE TRIGGER articles_site_revalidate AFTER INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.notify_site_revalidate();