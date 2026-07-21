// Tier 1 gate: runs on demand or on batch. Scans articles in editorial_status='draft'
// (or explicit article_ids) and either advances to 'passed_tier_1' or 'rejected'.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { tier1Gate } from "../_shared/editorial-filter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const limit = Math.min(Number(body.limit) || 200, 500);
  const ids: string[] | undefined = body.article_ids;

  let q = sb.from("articles")
    .select("id, title, seo_description, content")
    .or("editorial_status.is.null,editorial_status.eq.draft")
    .limit(limit);
  if (ids?.length) q = sb.from("articles").select("id, title, seo_description, content").in("id", ids);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let rejected = 0, passed = 0;
  for (const a of data ?? []) {
    const r = tier1Gate(a.title ?? "", a.seo_description ?? "", a.content ?? "");
    if (r.reject) {
      await sb.from("articles").update({
        editorial_status: "rejected",
        reject_tier: "tier_1_instant",
        reject_reason: r.reason,
        rejected_at: new Date().toISOString(),
        published: false,
      }).eq("id", a.id);
      await sb.from("editorial_rejections").insert({
        article_id: a.id, tier: "tier_1_instant", reason: r.reason,
        headline: a.title, rejected_by: "system",
      });
      if (r.reason && /international|no ghana nexus/i.test(r.reason)) {
        await sb.from("rejected_articles_international").insert({
          article_id: a.id,
          headline: a.title,
          reason_international_nexus: r.reason,
        });
      }
      rejected++;
    } else {
      await sb.from("articles").update({ editorial_status: "passed_tier_1" }).eq("id", a.id);
      passed++;
    }
  }

  return json({ scanned: data?.length ?? 0, passed, rejected });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
