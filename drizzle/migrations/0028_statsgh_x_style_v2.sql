-- StatsGH X style v2: link in first reply, self-reply test.
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS reply_post_id text,
  ADD COLUMN IF NOT EXISTS reply_text text,
  ADD COLUMN IF NOT EXISTS reply_status text,
  ADD COLUMN IF NOT EXISTS link_mode text,
  ADD COLUMN IF NOT EXISTS x_steps jsonb,
  ADD COLUMN IF NOT EXISTS x_post_deleted_at timestamptz;

ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_reply_status_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_reply_status_check
  CHECK (reply_status IS NULL OR reply_status IN ('pending','posted','failed','skipped','deleted'));

ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('rejected_crime','rejected_duplicate','rejected_ineligible','rejected_model','held','approved','posted','post_failed','discarded','expired','test'));

ALTER TABLE public.x_autopost_settings ALTER COLUMN prompt_version SET DEFAULT '2.0';
ALTER TABLE public.x_autopost_settings ALTER COLUMN link_mode SET DEFAULT 'first_reply';
UPDATE public.x_autopost_settings SET prompt_version = '2.0', link_mode = 'first_reply' WHERE id = 1;
-- mode is deliberately NOT touched (stays review_only).