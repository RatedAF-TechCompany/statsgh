// Retired: comments are now moderated by an editor (see submit-comment). Verification links no longer publish anything.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const h = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
serve((req) => req.method === "OPTIONS" ? new Response(null, { headers: h }) :
  new Response(JSON.stringify({ success: false, error: "Comments are now reviewed by an editor before they appear. No verification is needed." }), { status: 200, headers: h }));
