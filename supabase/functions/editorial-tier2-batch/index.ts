// Tier 2: AI batch scoring against the StatsGH winning formula.
// Runs every 6 hours via pg_cron. Processes up to 8 articles per invocation.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "google/gemini-2.5-flash-lite";
const BATCH_SIZE = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE) return json({ error: "LOVABLE_API_KEY missing" }, 500);

  const { data: arts, error } = await sb.from("articles")
    .select("id, title, seo_description")
    .eq("editorial_status", "passed_tier_1")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return json({ error: error.message }, 500);
  if (!arts?.length) return json({ scanned: 0 });

  const list = arts.map((a, i) => `${i + 1}. [${a.id}] ${a.title}\n   ${a.seo_description ?? ""}`).join("\n");
  const prompt = `Score each article against StatsGH's winning Twitter formula.
StatsGH publishes ONLY economic data journalism.

FORMULA (award 0 or 1 point each):
1 amount_or_data: specific currency amount (GHS/USD), % or count (>50k)
2 policy_action: Parliament, BoG, Minister, company launch, approval, decision
3 ghana_economic_impact: jobs, trade, forex, inflation, sector growth, tax, investment, consumer cost
4 surprising_angle: "more than X", "highest", "first time", "record"
5 primary_source: GSS, BoG, Parliament, company, sector authority (not gossip)

score = sum of points.
recommendation: >=3 "publish"; 2 "editor_review"; <2 "reject".

Articles:
${list}

Respond ONLY as JSON:
{"results":[{"article_id":"...","score":0,"points_breakdown":{"amount_or_data":0,"policy_action":0,"ghana_economic_impact":0,"surprising_angle":0,"primary_source":0},"recommendation":"publish|editor_review|reject","editorial_note":"..."}]}`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE },
    body: JSON.stringify({
      model: MODEL, temperature: 0.15, max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!aiRes.ok) {
    const t = await aiRes.text();
    return json({ error: `AI ${aiRes.status}: ${t}` }, aiRes.status === 429 || aiRes.status === 402 ? 200 : 500);
  }
  const aiJson = await aiRes.json();
  let parsed: any = {};
  try { parsed = JSON.parse(aiJson.choices[0].message.content); } catch { parsed = { results: [] }; }
  const results: any[] = parsed.results ?? [];

  let publish = 0, review = 0, reject = 0;
  for (const r of results) {
    const status = r.recommendation === "publish" ? "approved_auto"
      : r.recommendation === "editor_review" ? "awaiting_editor"
      : "rejected";
    const patch: any = {
      editorial_status: status,
      formula_score: r.score ?? null,
      formula_breakdown: r.points_breakdown ?? null,
      editorial_note: r.editorial_note ?? null,
    };
    if (status === "rejected") {
      patch.reject_tier = "tier_2_formula";
      patch.reject_reason = r.editorial_note ?? "formula score too low";
      patch.rejected_at = new Date().toISOString();
      patch.published = false;
    }
    if (status === "approved_auto") {
      patch.approved_by = "system";
      patch.approved_at = new Date().toISOString();
    }
    await sb.from("articles").update(patch).eq("id", r.article_id);

    if (status === "rejected") {
      await sb.from("editorial_rejections").insert({
        article_id: r.article_id, tier: "tier_2_formula",
        reason: r.editorial_note ?? "score<2",
        headline: arts.find(a => a.id === r.article_id)?.title,
        rejected_by: "system",
      });
      reject++;
    } else if (status === "approved_auto") {
      await sb.from("editorial_approvals").insert({
        article_id: r.article_id, approval_path: "auto", approved_by: "system",
      });
      publish++;
    } else {
      review++;
    }
  }

  return json({ scanned: arts.length, publish, review, reject });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
