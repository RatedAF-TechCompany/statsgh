-- StatsGH X style v3: plain-text master prompt v3, first reply kept, crime block off, long posts on.
ALTER TABLE public.x_autopost_settings
  ADD COLUMN IF NOT EXISTS block_crime boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_long_posts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_weighted_chars int NOT NULL DEFAULT 1000;
ALTER TABLE public.x_autopost_settings DROP CONSTRAINT IF EXISTS x_autopost_settings_max_weighted_chars_check;
ALTER TABLE public.x_autopost_settings ADD CONSTRAINT x_autopost_settings_max_weighted_chars_check
  CHECK (max_weighted_chars BETWEEN 280 AND 1000);
ALTER TABLE public.x_autopost_settings ALTER COLUMN prompt_version SET DEFAULT '3.0';
ALTER TABLE public.x_autopost_settings ALTER COLUMN link_mode SET DEFAULT 'first_reply';
UPDATE public.x_autopost_settings
   SET prompt_version = '3.0', link_mode = 'first_reply', block_crime = false, allow_long_posts = true, max_weighted_chars = 1000
 WHERE id = 1;
-- mode is deliberately NOT touched (stays review_only). AUTO_TWEET_ENABLED is not touched.