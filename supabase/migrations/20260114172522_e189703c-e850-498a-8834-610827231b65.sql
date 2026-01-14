-- Enable pg_net extension for HTTP calls (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_newsroom_scan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Make HTTP POST request to the newsroom-scheduled edge function
  PERFORM net.http_post(
    url := 'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/newsroom-scheduled?token=statsgh-newsroom-2026',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"triggerType": "scheduled"}'::jsonb
  );
  
  RAISE LOG 'Newsroom scan triggered at %', now();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_newsroom_scan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_newsroom_scan() TO service_role;