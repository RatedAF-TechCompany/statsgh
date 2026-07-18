import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generates 3 "next move" scenarios for a BoG rate change and attaches to article.
// Called by bog-dashboard-scan or manually with { articleId } after a rate change is detected.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const { articleId, currentRate, previousRate } = await req.json();
    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: article } = await supabase
      .from("articles")
      .select("id, title, summary, body")
      .eq("id", articleId)
      .maybeSingle();
    if (!article) {
      return new Response(JSON.stringify({ error: "article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are the StatsGH macro editor. The Bank of Ghana has just moved the policy rate.

CURRENT RATE: ${currentRate ?? "unknown"}
PREVIOUS RATE: ${previousRate ?? "unknown"}
CONTEXT: ${article.title}\n${article.summary || ""}

Generate exactly 3 forward-looking scenarios for the next 3 months. Each scenario must be concrete, cite the mechanism, and note who benefits or loses. Return ONLY valid JSON:

{
  "scenarios": [
    { "label": "Hold steady", "probability": "moderate", "mechanism": "...", "impact": "..." },
    { "label": "Cut by 100bps", "probability": "low", "mechanism": "...", "impact": "..." },
    { "label": "Hike by 100bps", "probability": "moderate", "mechanism": "...", "impact": "..." }
  ]
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(JSON.stringify({ error: "AI call failed", status: res.status, details: errBody }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const parsed = JSON.parse(jsonMatch[0]);
    const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios.slice(0, 3) : [];

    await supabase.from("articles").update({ article_scenarios: scenarios }).eq("id", articleId);

    return new Response(JSON.stringify({ success: true, scenarios }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
