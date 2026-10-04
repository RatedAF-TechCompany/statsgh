REVOKE SELECT ON public.audit_events, public.comments, public.contact_messages, public.expert_submissions, public.follows, public.newsletter_subscribers, public.profiles, public.user_invitations FROM anon;

GRANT INSERT ON public.contact_messages, public.expert_submissions TO anon;

REVOKE INSERT, UPDATE, DELETE ON public.audit_events, public.comments, public.follows, public.newsletter_subscribers, public.profiles, public.user_invitations FROM anon;

DROP POLICY IF EXISTS "Public read access" ON public.comments;

GRANT SELECT ON public.comments_public, public.author_profiles TO anon, authenticated;