import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIME_WINDOW_HOURS = 5;

// ============================================
// 1. STATS GH PREFERRED BUSINESS NEWS SOURCES
// ============================================
const NEWS_SOURCES = [
  { name: "Business and Financial Times", domain: "thebftonline.com" },
  { name: "Ghana Business News", domain: "ghanabusinessnews.com" },
  { name: "Graphic Business", domain: "graphic.com.gh" },
  { name: "Citi Newsroom Business", domain: "citinewsroom.com" },
  { name: "GhanaWeb Business", domain: "ghanaweb.com" },
  { name: "Modern Ghana Business", domain: "modernghana.com" },
  { name: "BusinessGhana", domain: "businessghana.com" },
  { name: "Business Day Ghana", domain: "businessdayghana.com" },
];

// ============================================
// 2. BUSINESS CATEGORIES
// ============================================
const VALID_CATEGORIES = [
  "public-finance",
  "markets",
  "banking",
  "energy",
  "trade",
  "tax",
  "debt",
  "inflation-prices",
  "commodities",
  "companies",
  "policy",
  "transport-logistics",
  "telecoms-digital",
  "agriculture",
  "mining",
  "real-estate",
] as const;

// ============================================
// 3. IMAGE STYLES (ROTATE)
// ============================================
const IMAGE_STYLES = [
  "conceptual-hard-news",
  "gritty-collage",
  "editorial-cartoon",
] as const;

const IMAGE_STYLE_PROMPTS: Record<string, string> = {
  "conceptual-hard-news": `Clean high-impact conceptual editorial illustration. Single central composition with balanced symmetry. Strong negative space and clear silhouette readable at small sizes. Smooth digital illustration with controlled subtle shading. Muted grey, off-white, black palette with ONE accent color only if meaningful. Generic illustrative people with neutral calm expressions if needed. Oversized or simplified objects for visual metaphor (money, coins, documents, clocks, buildings). Soft even lighting, low contrast. 16:9 aspect ratio. No text, no logos, no flags, no charts. Serious analytical neutral tone.`,
  
  "gritty-collage": `Gritty newspaper-style split-frame collage. Vertical split layout. LEFT PANEL: Black and white or near monochrome, tight cropped close-up, heavy grain, crushed blacks, high contrast, anonymous documentary feel. RIGHT PANEL: Red duotone or red wash treatment, wider context showing environment or collective impact, details readable under red overlay. Heavy halftone and rough print texture throughout. Infrastructure, tools, crowds, idle assets, empty spaces, blocked movement as subjects. Generic obscured figures only, no identifiable individuals. No logos, flags, or badges. 16:9 aspect ratio. Neutral observational tone.`,
  
  "editorial-cartoon": `Classic newspaper editorial cartoon style. Hand-drawn black ink lines on off-white newsprint texture background. High contrast between black ink and background. Primary palette: black and off-white. Maximum 2 accent colors (red or muted earth tones) used very sparingly and symbolically. One clear dominant visual metaphor. Balanced dynamic layout with clean negative space. Allowed symbols: documents, locks, chains, ships, factories, money, maps, broken links, idle machinery. Generic or symbolic figures only with expressions of tension, uncertainty, or concern. No gradients, no digital gloss, no realism. 16:9 aspect ratio. No text, labels, or logos. Serious critical analytical tone.`
};

function getRandomImageStyle(): string {
  return IMAGE_STYLES[Math.floor(Math.random() * IMAGE_STYLES.length)];
}

// ============================================
// 4. HELPERS (TIME, URL, NUMERIC HEADLINE, DEDUPE)
// ============================================
function nowUtc(): Date {
  return new Date();
}

function hoursAgo(hours: number): Date {
  return new Date(nowUtc().getTime() - hours * 60 * 60 * 1000);
}

function isWithinLastHours(dateIso: string, hours: number): boolean {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= hoursAgo(hours).getTime() && d.getTime() <= nowUtc().getTime();
}

function safeDomainFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sourceMatches(url: string, allowedDomain: string): boolean {
  const host = safeDomainFromUrl(url);
  if (!host) return false;
  const allowed = allowedDomain.replace(/^www\./, "");
  return host === allowed || host.endsWith("." + allowed);
}

// Numeric/statistical indicators in headline
function hasNumericIndicator(headline: string): boolean {
  const h = headline || "";
  const patterns = [
    /\b\d+(\.\d+)?\b/,
    /\bGHS\b|\bGH¢\b/i,
    /\bUS\$|\$\b/,
    /\b%/,
    /\bbn\b|\bbillion\b|\bm\b|\bmillion\b|\btrillion\b/i,
    /\brate\b|\byield\b|\binflation\b|\btarget\b|\bquota\b|\bbudget\b/i,
    /\b202[0-9]\b|\b20[0-9]{2}\b/,
  ];
  return patterns.some((re) => re.test(h));
}

// Build a story fingerprint so the same underlying event is suppressed across sources
function normalizeForDedupe(s: string): string {
  const lower = (s || "").toLowerCase();
  const cleaned = lower
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9%$¢\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stop = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","as","at","by",
    "ghana","ghanas","says","report","reports","new","today","latest","update",
    "over","amid","after","before","from","into","sets","set","plans","plan",
    "announces","announce","announced",
  ]);

  const tokens = cleaned
    .split(" ")
    .filter((t) => t.length >= 2 && !stop.has(t));

  tokens.sort();
  return tokens.slice(0, 32).join(" ");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");
    
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body = await req.json().catch(() => ({}));
    const triggerType = body.trigger_type || body.triggerType || "manual";

    const { data: run, error: runError } = await supabase
      .from("newsroom_runs")
      .insert({
        trigger_type: triggerType,
        status: "running",
        articles_found: 0,
        articles_created: 0,
        created_by: userId,
      })
      .select()
      .single();

    if (runError) throw new Error(`Failed to create run: ${runError.message}`);

    console.log(`Started newsroom run: ${run.id}`);

    // ============================================
    // 5. SEARCH PROMPT (STRICT FILTERS)
    // ============================================
    const sourcesList = NEWS_SOURCES.map((s) => `${s.name} (${s.domain})`).join(", ");
    const searchPrompt = `You are StatsGH's BUSINESS news scanner.

Scan ONLY these Ghana business sources: ${sourcesList}.

Return ONLY business/economy/policy/markets stories that meet ALL conditions:
1) published within the last ${TIME_WINDOW_HOURS} hours (use the source's own published timestamp),
2) headline contains at least one numeric/statistical indicator such as GHS/GH¢ amounts, US$, %, billion/million, rates, targets, quotas, years, counts,
3) do NOT repeat the same underlying story (same event/figures/announcement) even if it appears on another source with a slightly different headline.

Return ONLY a valid JSON array of 5 to 12 items. Each item MUST include:
- source_name: must be exactly one of: ${NEWS_SOURCES.map((s) => s.name).join(", ")}
- original_headline: string
- original_summary: 1 to 2 plain sentences
- source_url: the exact article URL from that source
- published_at: ISO 8601 timestamp string
- category_hint: one of: ${VALID_CATEGORIES.join(", ")}
- dedupe_hint: short string capturing the key event and figures (e.g. "BoG GH¢7.1bn losses 2022-2024")

Do not include any item if you cannot confirm published_at within the last ${TIME_WINDOW_HOURS} hours.

Return ONLY JSON.`;

    const searchCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        { role: "system", content: "Return only valid JSON. No markdown." },
        { role: "user", content: searchPrompt },
      ],
    });

    const newsContent = searchCompletion.choices?.[0]?.message?.content || "[]";

    let newsItems: any[] = [];
    try {
      // Handle potential markdown code blocks
      let jsonStr = newsContent;
      const jsonMatch = newsContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      newsItems = JSON.parse(jsonStr);
      if (!Array.isArray(newsItems)) newsItems = [];
    } catch {
      console.error("Failed to parse news items:", newsContent);
      newsItems = [];
    }

    console.log(`AI found ${newsItems.length} potential news items`);

    // Hard filter again server-side (never trust model output)
    const filtered: any[] = [];
    for (const item of newsItems) {
      const sourceName = String(item.source_name || "").trim();
      const headline = String(item.original_headline || "").trim();
      const url = String(item.source_url || "").trim();
      const publishedAt = String(item.published_at || "").trim();

      if (!sourceName || !headline || !url || !publishedAt) continue;
      if (!NEWS_SOURCES.some((s) => s.name === sourceName)) continue;

      const source = NEWS_SOURCES.find((s) => s.name === sourceName)!;
      if (!sourceMatches(url, source.domain)) continue;

      if (!isWithinLastHours(publishedAt, TIME_WINDOW_HOURS)) continue;
      if (!hasNumericIndicator(headline)) continue;

      filtered.push(item);
    }

    console.log(`After filtering: ${filtered.length} qualifying items`);

    if (filtered.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "no_news",
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: "No qualifying items",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute dedupe_key and suppress repeats across runs/sources
    const deduped: any[] = [];
    for (const item of filtered) {
      const headline = String(item.original_headline || "");
      const hint = String(item.dedupe_hint || "");
      const keyBase = normalizeForDedupe(`${headline} ${hint}`);
      const dedupeKey = await sha256Hex(keyBase);

      // Check if already notified/processed previously (across all sources)
      const { data: seen } = await supabase
        .from("newsroom_articles")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .limit(1);

      if (seen && seen.length > 0) {
        console.log(`Skipping duplicate (newsroom): ${headline.substring(0, 50)}...`);
        continue;
      }

      const { data: seenPublished } = await supabase
        .from("articles")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .limit(1);

      if (seenPublished && seenPublished.length > 0) {
        console.log(`Skipping duplicate (articles): ${headline.substring(0, 50)}...`);
        continue;
      }

      item._dedupe_key = dedupeKey;
      deduped.push(item);
    }

    console.log(`After deduplication: ${deduped.length} new items`);

    if (deduped.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "no_news",
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: "All items were duplicates",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert pending
    const newsRecords = deduped.map((item) => ({
      run_id: run.id,
      source_name: item.source_name,
      original_headline: item.original_headline,
      original_summary: item.original_summary || "",
      source_url: item.source_url,
      published_at: item.published_at,
      category_hint: item.category_hint || null,
      dedupe_key: item._dedupe_key,
      processing_status: "pending",
    }));

    const { data: insertedNews, error: insertError } = await supabase
      .from("newsroom_articles")
      .insert(newsRecords)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert newsroom items: ${insertError.message}`);
    }

    await supabase.from("newsroom_runs").update({
      articles_found: insertedNews?.length || 0,
    }).eq("id", run.id);

    // ============================================
    // 6. PROCESS EACH ITEM INTO A STATSGH ARTICLE
    // ============================================
    let articlesCreated = 0;

    for (const newsItem of insertedNews || []) {
      try {
        await supabase.from("newsroom_articles").update({
          processing_status: "processing",
        }).eq("id", newsItem.id);

        // Secondary duplicate guard
        const { data: already } = await supabase
          .from("articles")
          .select("id")
          .eq("dedupe_key", newsItem.dedupe_key)
          .limit(1);

        if (already && already.length > 0) {
          await supabase.from("newsroom_articles").update({
            processing_status: "duplicate",
          }).eq("id", newsItem.id);
          continue;
        }

        const businessArticlePrompt = `You are the StatsGH automated newsroom editor for BUSINESS and ECONOMIC news.

INPUT FIELDS:
original_headline, original_summary, source_name, source_url, published_at.

Before writing, do a live verification scan across the web. Use the original source plus at least two other credible outlets or primary documents where available. If a detail cannot be independently verified, mark it as unconfirmed and attribute it to the original outlet.

STRICT WRITING RULES:
Do not use colons.
Do not use long dashes.
Do not use bullet points.
Do not use emojis or hashtags.
Do not add links or URLs in the output.
Use "GHS" (not GHC). Use "%" symbol.
Keep tone neutral and factual.

OUTPUT JSON KEYS (exact):
headline (max 80 chars)
subtitle (one sentence)
summary (max 400 chars)
body (4 to 8 HTML <p> paragraphs, no links)
seo_description (max 155 chars)
slug (lowercase hyphens)
section (one of: ${VALID_CATEGORIES.join(", ")})
tags (array)
image_prompt (max 50 words, no text overlays, no logos, no identifiable real persons)
twitter_post (short, factual, no emojis or hashtags)
instagram_compressed (short headline plus "See full article link in bio.")

ORIGINAL NEWS ITEM:
headline: ${newsItem.original_headline}
summary: ${newsItem.original_summary}
source_name: ${newsItem.source_name}
source_url: ${newsItem.source_url}
published_at: ${newsItem.published_at}

Return ONLY valid JSON.`;

        const articleCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 2000,
          messages: [
            { role: "system", content: "Return only valid JSON. No markdown." },
            { role: "user", content: businessArticlePrompt },
          ],
        });

        const articleContent = articleCompletion.choices?.[0]?.message?.content || "{}";

        let articleJson: any;
        try {
          // Handle potential markdown code blocks
          let jsonStr = articleContent;
          const jsonMatch = articleContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1];
          }
          articleJson = JSON.parse(jsonStr);
        } catch {
          throw new Error("Failed to parse article JSON");
        }

        const slugBase = String(articleJson.slug || articleJson.headline || "article")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .substring(0, 80);

        const articleSlug = `${slugBase}-${Date.now()}`;

        // ============================================
        // 7. IMAGE GENERATION
        // ============================================
        const imageStyle = getRandomImageStyle();
        const stylePrompt = IMAGE_STYLE_PROMPTS[imageStyle];
        const aiImagePrompt = String(articleJson.image_prompt || `Ghana business news about ${articleJson.headline}`);
        const imagePrompt = `${stylePrompt}. ${aiImagePrompt}. Ghana setting.`;

        let heroImageUrl: string | null = null;

        try {
          console.log(`Generating image for: ${articleSlug}, style: ${imageStyle}`);
          
          const imageGenResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: imagePrompt,
            n: 1,
            size: "1792x1024",
            quality: "standard",
            style: "vivid",
          });

          const generatedImageUrl = imageGenResponse.data?.[0]?.url;

          if (generatedImageUrl) {
            // Download the image from OpenAI's temporary URL
            const imageDownload = await fetch(generatedImageUrl);
            if (imageDownload.ok) {
              const imageBuffer = new Uint8Array(await imageDownload.arrayBuffer());

              const imagePath = `newsroom/${articleSlug}.png`;
              const { error: uploadError } = await supabase.storage
                .from("media")
                .upload(imagePath, imageBuffer, { contentType: "image/png", upsert: true });

              if (!uploadError) {
                const { data: publicUrl } = supabase.storage
                  .from("media")
                  .getPublicUrl(imagePath);
                heroImageUrl = publicUrl.publicUrl;
                console.log(`Image uploaded: ${heroImageUrl}`);
              } else {
                console.error("Image upload error:", uploadError);
              }
            }
          }
        } catch (imgError) {
          console.error("Image generation error:", imgError);
        }

        await supabase.from("newsroom_articles").update({
          image_style: imageStyle,
        }).eq("id", newsItem.id);

        // Validate section
        let section = articleJson.section || "markets";
        if (!VALID_CATEGORIES.includes(section as any)) {
          section = "markets";
        }

        // Truncate fields if needed
        let summary = articleJson.summary || "";
        if (summary.length > 400) {
          summary = summary.substring(0, 397) + "...";
        }
        let seoDescription = articleJson.seo_description || "";
        if (seoDescription.length > 155) {
          seoDescription = seoDescription.substring(0, 152) + "...";
        }

        // ============================================
        // 8. SAVE & PUBLISH
        // ============================================
        const { data: newArticle, error: articleError } = await supabase
          .from("articles")
          .insert({
            title: articleJson.headline,
            subtitle: articleJson.subtitle,
            summary: summary,
            body: articleJson.body,
            slug: articleSlug,
            category_slug: section,
            section: section,
            author_name: "StatsGH Newsroom",
            tags: Array.isArray(articleJson.tags) ? articleJson.tags : [],
            seo_description: seoDescription,
            twitter_post: articleJson.twitter_post,
            instagram_comment: "See full article link in bio.",
            instagram_compressed: articleJson.instagram_compressed,
            hero_image_url: heroImageUrl,
            is_published: true,
            published_at: new Date().toISOString(),
            status: "published",
            dedupe_key: newsItem.dedupe_key,
          })
          .select()
          .single();

        if (articleError) throw new Error(`Failed to save article: ${articleError.message}`);

        await supabase.from("newsroom_articles").update({
          processing_status: "completed",
          generated_article_id: newArticle.id,
        }).eq("id", newsItem.id);

        articlesCreated++;
        console.log(`Created article: ${newArticle.title}`);
      } catch (error) {
        console.error("Error processing news item:", error);
        await supabase.from("newsroom_articles").update({
          processing_status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        }).eq("id", newsItem.id);
      }
    }

    await supabase.from("newsroom_runs").update({
      status: "completed",
      articles_created: articlesCreated,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    // Send email notification to admins if articles were created
    if (articlesCreated > 0) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          const resend = new Resend(RESEND_API_KEY);
          
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "editor"]);
          
          if (adminRoles && adminRoles.length > 0) {
            const { data: adminProfiles } = await supabase
              .from("profiles")
              .select("email")
              .in("id", adminRoles.map(r => r.user_id));
            
            const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
            
            if (adminEmails.length > 0) {
              await resend.emails.send({
                from: "StatsGH Newsroom <noreply@statsgh.com>",
                to: adminEmails,
                subject: `📰 ${articlesCreated} New Article${articlesCreated > 1 ? "s" : ""} Auto-Published`,
                html: `
                  <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a1a1a;">StatsGH Automated Newsroom</h2>
                    <p style="color: #333; font-size: 16px;">
                      The newsroom system has automatically published <strong>${articlesCreated} new article${articlesCreated > 1 ? "s" : ""}</strong>.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                      Trigger: ${triggerType === "scheduled" ? "Scheduled scan" : "Manual scan"}<br>
                      Sources scanned: ${deduped.length}<br>
                      Run ID: ${run.id}
                    </p>
                    <a href="https://statsgh.com/admin/newsroom" 
                       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
                      View in Newsroom Dashboard
                    </a>
                    <p style="color: #999; font-size: 12px; margin-top: 24px;">
                      This is an automated notification from StatsGH Newsroom.
                    </p>
                  </div>
                `,
              });
              console.log(`Notification email sent to ${adminEmails.length} admin(s)`);
            }
          }
        } catch (emailError) {
          console.error("Failed to send notification email:", emailError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      run_id: run.id,
      articles_found: insertedNews?.length || 0,
      articles_created: articlesCreated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Newsroom scan error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
