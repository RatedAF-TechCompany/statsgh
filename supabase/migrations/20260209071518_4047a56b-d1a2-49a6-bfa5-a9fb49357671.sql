
-- ============================================
-- SECURITY FIX: Comprehensive RLS hardening
-- ============================================

-- 1. COMMENTS PII PROTECTION
-- Create a safe view that excludes email, verification_code, verification_expires_at
CREATE VIEW public.comments_public AS
SELECT id, article_id, name, body, created_at, parent_id
FROM public.comments
WHERE is_published = true;

-- Grant access to the safe view
GRANT SELECT ON public.comments_public TO anon, authenticated;

-- Remove public SELECT on base table (the view handles public access)
DROP POLICY IF EXISTS "Anyone can view published comments" ON public.comments;

-- Only admins can read the full comments table (for moderation)
CREATE POLICY "Admins can view all comments" ON public.comments
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. REMOVE OVERLY PERMISSIVE INSERT/UPDATE/ALL POLICIES
-- These operations are only needed by edge functions which use service_role key (bypasses RLS)

-- Comments: Remove public INSERT and UPDATE (edge functions use service role)
DROP POLICY IF EXISTS "System can insert comments" ON public.comments;
DROP POLICY IF EXISTS "System can update comments" ON public.comments;

-- Audit events: Restrict INSERT to authenticated users only (was WITH CHECK true)
DROP POLICY IF EXISTS "System can insert audit events" ON public.audit_events;
CREATE POLICY "Authenticated users can insert audit events" ON public.audit_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Ingestion runs: Remove public ALL (service role bypasses RLS)
DROP POLICY IF EXISTS "System can manage ingestion runs" ON public.ingestion_runs;

-- BOG scan items: Remove public ALL (service role bypasses RLS)
DROP POLICY IF EXISTS "Service can manage bog_scan_items" ON public.bog_scan_items;

-- Dashboard updates: Remove public ALL (service role bypasses RLS)
DROP POLICY IF EXISTS "Service can manage dashboard_updates" ON public.dashboard_updates;

-- BOG scan runs: Remove public ALL (service role bypasses RLS)
DROP POLICY IF EXISTS "Service can manage bog_scan_runs" ON public.bog_scan_runs;

-- 3. FIX STORAGE UPDATE POLICY
-- Current policy allows any authenticated user to update any file
-- Restrict to admins and editors only
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
CREATE POLICY "Admins and editors can update media" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'media'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
  )
);
