// RETIRED 2026-10: the only StatsGH X path is statsgh-x-autopost.
// This function can no longer generate or post tweets. Stray callers get a clear 410.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({
      success: false,
      retired: true,
      error: "retired 2026-10: the only StatsGH X path is statsgh-x-autopost",
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
