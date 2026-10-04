CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.scheduler_auth (name text PRIMARY KEY, token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON private.scheduler_auth FROM PUBLIC, anon, authenticated;
ALTER TABLE private.scheduler_auth ENABLE ROW LEVEL SECURITY;
INSERT INTO private.scheduler_auth(name, token)
  SELECT 'cron', encode(extensions.gen_random_bytes(32),'hex')
  WHERE NOT EXISTS (SELECT 1 FROM private.scheduler_auth WHERE name='cron');

CREATE OR REPLACE FUNCTION public.verify_scheduler_token(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT coalesce(length(p_token) >= 32 AND EXISTS (SELECT 1 FROM private.scheduler_auth WHERE name='cron' AND token = p_token), false)
$$;
REVOKE ALL ON FUNCTION public.verify_scheduler_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_scheduler_token(text) TO service_role;

CREATE OR REPLACE FUNCTION private.scheduler_headers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private AS $$
  SELECT jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token) FROM private.scheduler_auth WHERE name='cron'
$$;
REVOKE ALL ON FUNCTION private.scheduler_headers() FROM PUBLIC, anon, authenticated;