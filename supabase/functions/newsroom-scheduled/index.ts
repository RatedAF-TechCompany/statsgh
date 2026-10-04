// Scheduled newsroom trigger.
// Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> or Bearer <CRON_SECRET> (if set).
// Returns 202 immediately and runs newsroom-scan in the background so callers
// never hit the 150s idle timeout.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizeCaller } from "../_shared/scheduler-auth.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = await authorizeCaller(req, createClient(Deno.env.get("SUPABASE_URL")!, serviceKey));
  const ok = auth.ok;
  if (!ok) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const job = (async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/newsroom-scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "scheduled" }),
      });
      console.log("newsroom-scan finished", res.status);
    } catch (e) {
      console.error("newsroom-scan failed", (e as Error).message);
    }
  })();

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(job);
  return json({ accepted: true, started_at: new Date().toISOString() }, 202);
});
