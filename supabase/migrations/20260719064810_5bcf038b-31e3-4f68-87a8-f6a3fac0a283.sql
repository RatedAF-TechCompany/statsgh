
-- Add editorial columns to articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS editorial_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reject_tier TEXT,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS formula_score NUMERIC,
  ADD COLUMN IF NOT EXISTS formula_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS editorial_note TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_editorial_status ON public.articles(editorial_status);

-- Rejections log
CREATE TABLE IF NOT EXISTS public.editorial_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  reason TEXT,
  headline TEXT,
  rejected_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.editorial_rejections TO authenticated;
GRANT ALL ON public.editorial_rejections TO service_role;
ALTER TABLE public.editorial_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and editors view rejections" ON public.editorial_rejections
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

-- Approvals log
CREATE TABLE IF NOT EXISTS public.editorial_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  approval_path TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tweeted BOOLEAN DEFAULT false
);
GRANT SELECT ON public.editorial_approvals TO authenticated;
GRANT ALL ON public.editorial_approvals TO service_role;
ALTER TABLE public.editorial_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and editors view approvals" ON public.editorial_approvals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

-- Daily metrics
CREATE TABLE IF NOT EXISTS public.editorial_daily_metrics (
  date DATE PRIMARY KEY,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.editorial_daily_metrics TO authenticated;
GRANT ALL ON public.editorial_daily_metrics TO service_role;
ALTER TABLE public.editorial_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and editors view daily metrics" ON public.editorial_daily_metrics
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

-- Editor decision RPC (tier 3)
CREATE OR REPLACE FUNCTION public.editor_decide_article(
  p_article_id UUID,
  p_decision TEXT,
  p_note TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'editor')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;

  IF p_decision = 'publish' THEN
    UPDATE public.articles
      SET editorial_status = 'approved_editor',
          approved_by = COALESCE(v_email, v_uid::text),
          approved_at = now(),
          editorial_note = p_note
      WHERE id = p_article_id;
    INSERT INTO public.editorial_approvals(article_id, approval_path, approved_by)
      VALUES (p_article_id, 'editor', COALESCE(v_email, v_uid::text));
  ELSIF p_decision = 'reject' THEN
    UPDATE public.articles
      SET editorial_status = 'rejected',
          reject_tier = 'tier_3_editor',
          reject_reason = COALESCE(p_note,'editor rejected'),
          rejected_at = now(),
          published = false
      WHERE id = p_article_id;
    INSERT INTO public.editorial_rejections(article_id, tier, reason, rejected_by)
      VALUES (p_article_id, 'tier_3_editor', p_note, COALESCE(v_email, v_uid::text));
  ELSIF p_decision = 'revise' THEN
    UPDATE public.articles
      SET editorial_status = 'needs_revision',
          editorial_note = p_note
      WHERE id = p_article_id;
  ELSE
    RAISE EXCEPTION 'Unknown decision %', p_decision;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.editor_decide_article(UUID, TEXT, TEXT) TO authenticated;
