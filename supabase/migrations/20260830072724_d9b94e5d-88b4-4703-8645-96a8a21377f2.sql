REVOKE ALL ON FUNCTION public.claim_news_event(text,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_event_update(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_next_tweet(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stale_tweet_claims() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_news_event(text,text,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_event_update(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_tweet(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stale_tweet_claims() TO service_role;