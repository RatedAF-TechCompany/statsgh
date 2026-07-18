import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const slackKey = Deno.env.get("SLACK_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Top 5 articles by view count in the last 7 days
    const { data: topArticles } = await supabase
      .from("articles")
      .select("id, title, slug, category_slug, summary, published_at, view_count")
      .eq("is_published", true)
      .gte("published_at", since)
      .order("view_count", { ascending: false, nullsFirst: false })
      .limit(5);

    // New indicators / data series added this week
    const { data: newSeries } = await supabase
      .from("data_series")
      .select("id, name, slug, updated_at")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(5);

    const articles = topArticles || [];
    const series = newSeries || [];

    // Build HTML email
    const articlesHtml = articles.map((a: any) => `
      <div style="border-bottom:1px solid #EFEFEF;padding:16px 0;">
        <a href="https://statsgh.com/${a.category_slug}/${a.slug}" style="color:#121212;text-decoration:none;font-family:Georgia,serif;font-size:18px;font-weight:700;">${a.title}</a>
        ${a.summary ? `<p style="color:#5B5B5B;font-family:Helvetica,sans-serif;font-size:14px;margin:6px 0 0;">${a.summary}</p>` : ""}
      </div>
    `).join("");

    const seriesHtml = series.length
      ? `<h2 style="font-family:Georgia,serif;color:#121212;margin-top:32px;">New data this week</h2>${series.map((s: any) => `<div style="padding:8px 0;"><a href="https://statsgh.com/data/${s.slug}" style="color:#E3120B;text-decoration:none;font-family:Helvetica,sans-serif;">${s.name}</a></div>`).join("")}`
      : "";

    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#FAF7F2;">
      <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;">
        <p style="font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5B5B5B;margin:0;">StatsGH Weekly</p>
        <h1 style="font-family:Georgia,serif;color:#121212;margin:8px 0 24px;">This week in Ghana's economy</h1>
        ${articlesHtml || '<p style="font-family:Helvetica,sans-serif;color:#5B5B5B;">No articles this week.</p>'}
        ${seriesHtml}
        <p style="font-family:Helvetica,sans-serif;font-size:12px;color:#8A8A8A;margin-top:32px;">Read more at <a href="https://statsgh.com" style="color:#E3120B;">statsgh.com</a></p>
      </div></body></html>`;

    // Send email via Resend
    let emailResult: any = { skipped: true };
    if (resendKey) {
      const { data: subs } = await supabase.from("profiles").select("email").not("email", "is", null);
      const recipients = (subs || []).map((s: any) => s.email).filter(Boolean).slice(0, 50);
      if (recipients.length) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "StatsGH Weekly <weekly@statsgh.com>",
            to: recipients,
            subject: "StatsGH Weekly — top stories in Ghana's economy",
            html,
          }),
        });
        emailResult = { sent: recipients.length, ok: res.ok, status: res.status };
      }
    }

    // Post to Slack if connected
    let slackResult: any = { skipped: true };
    if (slackKey && lovableKey && articles.length > 0) {
      const text = `*StatsGH Weekly*\n\n${articles.map((a: any, i: number) => `${i + 1}. <https://statsgh.com/${a.category_slug}/${a.slug}|${a.title}>`).join("\n")}`;
      const channel = Deno.env.get("SLACK_DIGEST_CHANNEL") || "#general";
      const res = await fetch("https://connector-gateway.lovable.dev/slack/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": slackKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, text, unfurl_links: true }),
      });
      const json = await res.json().catch(() => ({}));
      slackResult = { ok: json.ok, error: json.error };
    }

    return new Response(JSON.stringify({
      success: true,
      articles: articles.length,
      series: series.length,
      email: emailResult,
      slack: slackResult,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
