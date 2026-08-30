// RETIRED 2026-08-16 (forensic tightening, RULE 12).
// This was a SECOND route that could flip articles live, in parallel with
// newsroom-scan. There is now exactly one publication path:
//   newsroom-scan -> hard editorial gate -> canonical event claim -> articles
// plus the human path (manual-article-submit / admin editor) and the
// scheduled-publisher for already-approved, already-gated articles.
// This endpoint no longer publishes anything.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({
      success: false,
      retired: true,
      error:
        "editorial-publish-gate is retired. Publication happens only inside newsroom-scan after the shared editorial gate and canonical event claim.",
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
