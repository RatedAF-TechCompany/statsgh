// RETIRED 2026-08-09: superseded by the single StatsGH tweet pipeline
// (tweet-batch-generator -> tweet-hourly-poster). This function can no longer
// post to X. It exists only so any stray caller gets a clear 410.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({
      success: false,
      retired: true,
      error:
        "daily-batch-tweet-filter is retired. The only automated StatsGH tweet pipeline is tweet-batch-generator (validation + generation) followed by tweet-hourly-poster (posting).",
    }),
    {
      status: 410,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Content-Type": "application/json",
      },
    },
  )
);
