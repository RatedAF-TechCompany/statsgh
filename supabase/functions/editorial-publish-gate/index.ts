// Tier 4: publish gate. Flips approved articles live and marks them for Twitter.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { tier1Gate } from "../_shared/editorial-filter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: arts, error } = await sb.from("articles")
    .select("id, title, seo_description, content, published")
    .in("editorial_status", ["approved_auto", "approved_editor"])
    .eq("published", false)
    .limit(50);
  if (error) return json({ error: error.message }, 500);

  let live = 0, reverted = 0;
  for (const a of arts ?? []) {
    // final sanity: last-minute edits must still clear tier 1
    const t1 = tier1Gate(a.title ?? "", a.seo_description ?? "", a.content ?? "");
    if (t1.reject) {
      await sb.from("articles").update({
        editorial_status: "rejected",
        reject_tier: "tier_1_instant",
        reject_reason: `publish-gate: ${t1.reason}`,
        rejected_at: new Date().toISOString(),
        published: false,
      }).eq("id", a.id);
      reverted++;
      continue;
    }
    await sb.from("articles").update({
      published: true,
      published_at: new Date().toISOString(),
    }).eq("id", a.id);
    live++;
  }
  return json({ scanned: arts?.length ?? 0, live, reverted });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
