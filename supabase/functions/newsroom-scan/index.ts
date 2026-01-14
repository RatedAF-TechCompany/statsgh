import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIME_WINDOW_HOURS = 12; // 12-hour window for comprehensive coverage

// ============================================
// 1. STATS GH NEWS SOURCES (COMPREHENSIVE)
// ============================================
const NEWS_SOURCES = [
  // Business/Financial - Primary
  { name: "Business and Financial Times", domain: "thebftonline.com" },
  { name: "Ghana Business News", domain: "ghanabusinessnews.com" },
  { name: "BusinessGhana", domain: "businessghana.com" },
  { name: "The High Street Journal", domain: "thehighstreetjournal.com" },
  
  // Major News Portals
  { name: "GhanaWeb", domain: "ghanaweb.com" },
  { name: "Graphic Online", domain: "graphic.com.gh" },
  { name: "MyJoyOnline", domain: "myjoyonline.com" },
  { name: "Citi Newsroom", domain: "citinewsroom.com" },
  { name: "Ghana News Agency", domain: "gna.org.gh" },
  { name: "Ghanaian Times", domain: "ghanaiantimes.com.gh" },
  { name: "Modern Ghana", domain: "modernghana.com" },
  { name: "Pulse Ghana", domain: "pulse.com.gh" },
  { name: "YEN Ghana", domain: "yen.com.gh" },
  { name: "Daily Graphic", domain: "dailygraphic.com.gh" },
  
  // Radio/Broadcast
  { name: "Asaase Radio", domain: "asaaseradio.com" },
  { name: "Peace FM Online", domain: "peacefmonline.com" },
  { name: "Adom Online", domain: "adomonline.com" },
  { name: "Starr FM", domain: "starrfm.com.gh" },
  { name: "3News", domain: "3news.com" },
  { name: "TV3 Ghana", domain: "tv3network.com" },
  
  // International with Ghana coverage
  { name: "BBC Africa", domain: "bbc.com" },
  { name: "Reuters", domain: "reuters.com" },
  { name: "Bloomberg Africa", domain: "bloomberg.com" },
  { name: "Financial Times", domain: "ft.com" },
  { name: "African Business", domain: "african.business" },
  { name: "The Africa Report", domain: "theafricareport.com" },
  
  // Regional/Government
  { name: "Bank of Ghana", domain: "bog.gov.gh" },
  { name: "Ministry of Finance", domain: "mofep.gov.gh" },
  { name: "Ghana Statistical Service", domain: "statsghana.gov.gh" },
] as const;

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
// 4. HELPERS (TIME, URL, DEDUPE)
// ============================================
function nowUtc(): Date {
  return new Date();
}

function hoursAgo(hours: number): Date {
  return new Date(nowUtc().getTime() - hours * 60 * 60 * 1000);
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
    
    // Use OpenAI API directly with gpt-4o
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
    // 5. COMPREHENSIVE WEB SEARCH PROMPT (GPT-4o)
    // ============================================
    const currentTime = new Date().toISOString();
    
    const sourcesList = NEWS_SOURCES.map((s) => `${s.name} (${s.domain})`).join(", ");
    
    const searchPrompt = `You are StatsGH's comprehensive BUSINESS and ECONOMIC news scanner.

CURRENT DATE/TIME: ${currentTime}
SCAN WINDOW: Last ${TIME_WINDOW_HOURS} hours

YOUR MISSION:
Search for the LATEST Ghana business, economic, and financial news from these sources:

PRIMARY SOURCES TO SCAN:
${sourcesList}

ALSO SEARCH:
- Government press releases (Bank of Ghana, Ministry of Finance, Ghana Statistical Service)
- International wire services covering Ghana (Reuters, Bloomberg, AFP)
- Financial data announcements (IMF, World Bank, African Development Bank)
- Corporate announcements from major Ghanaian companies

STRICT REQUIREMENTS:
1. Only return stories published within the last ${TIME_WINDOW_HOURS} hours (since ${hoursAgo(TIME_WINDOW_HOURS).toISOString()})
2. Focus on BUSINESS, ECONOMY, FINANCE, POLICY, MARKETS, TRADE, BANKING, ENERGY, COMMODITIES
3. Prioritize stories with:
   - Specific numbers, percentages, or monetary figures
   - Official announcements or policy changes
   - Market movements or economic indicators
   - Corporate earnings, deals, or major business developments
4. Do NOT repeat the same underlying story from different sources
5. Verify information across multiple sources where possible

EDITORIAL STANDARDS (Daily Mail accessibility + Financial Times accuracy):
- Lead with the most newsworthy figure or fact
- Use plain English that anyone can understand
- Be precise with numbers and attributions
- Include context for why the story matters

Return a valid JSON array of 5 to 15 items. Each item MUST include:
{
  "source_name": "Exact source name from list above",
  "original_headline": "The actual headline as published",
  "original_summary": "2-3 sentence summary with key figures",
  "source_url": "Full URL to the article",
  "published_at": "ISO 8601 timestamp",
  "category_hint": "One of: ${VALID_CATEGORIES.join(", ")}",
  "key_figures": "Main numbers/percentages in the story",
  "verification_status": "confirmed" or "single_source",
  "dedupe_hint": "Short unique identifier for the story event"
}

CRITICAL: Only include stories you can verify were published within the time window. If unsure about timing, exclude the story.

Return ONLY valid JSON array, no markdown, no explanation.`;

    console.log("Calling OpenAI GPT-4o for news search...");
    
    const newsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional news researcher. Return only valid JSON arrays. No markdown formatting." },
        { role: "user", content: searchPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const newsContent = newsResponse.choices[0]?.message?.content || "";

    let newsItems: any[] = [];
    try {
      // Handle potential markdown code blocks
      let jsonStr = newsContent;
      const jsonMatch = newsContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      // Also try to extract JSON array if wrapped in text
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
      newsItems = JSON.parse(jsonStr);
      if (!Array.isArray(newsItems)) newsItems = [];
    } catch (parseError) {
      console.error("Failed to parse news items:", newsContent.substring(0, 500));
      newsItems = [];
    }

    console.log(`AI found ${newsItems.length} potential news items`);

    // Filter and validate items
    const filtered: any[] = [];
    for (const item of newsItems) {
      const sourceName = String(item.source_name || "").trim();
      const headline = String(item.original_headline || "").trim();
      
      if (!sourceName || !headline) {
        console.log(`Skipped: missing sourceName or headline`);
        continue;
      }
      
      // Validate source name matches our list (flexible matching)
      const matchedSource = NEWS_SOURCES.find((s) => 
        s.name.toLowerCase() === sourceName.toLowerCase() ||
        sourceName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]) ||
        sourceName.toLowerCase().includes(s.domain.replace('.com', '').replace('.gh', '').replace('.org', ''))
      );
      
      if (!matchedSource) {
        // Allow international sources that cover Ghana
        const isInternational = ['bbc', 'reuters', 'bloomberg', 'financial times', 'african business', 'africa report', 'imf', 'world bank'].some(
          src => sourceName.toLowerCase().includes(src)
        );
        if (!isInternational) {
          console.log(`Skipped: unrecognized source "${sourceName}"`);
          continue;
        }
      }
      
      console.log(`Accepted: "${headline.substring(0, 60)}..." from ${sourceName}`);
      filtered.push({
        ...item,
        source_name: matchedSource?.name || sourceName,
      });
    }

    console.log(`After filtering: ${filtered.length} qualifying items`);

    if (filtered.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "no_news",
        completed_at: new Date().toISOString(),
        metadata: { model: "gpt-4o", time_window: TIME_WINDOW_HOURS }
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: "No qualifying items found in search",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute dedupe_key and suppress repeats
    const deduped: any[] = [];
    for (const item of filtered) {
      const headline = String(item.original_headline || "");
      const hint = String(item.dedupe_hint || "");
      const keyBase = normalizeForDedupe(`${headline} ${hint}`);
      const dedupeKey = await sha256Hex(keyBase);

      // Check for duplicates in newsroom_articles
      const { data: seen } = await supabase
        .from("newsroom_articles")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .limit(1);

      if (seen && seen.length > 0) {
        console.log(`Skipping duplicate (newsroom): ${headline.substring(0, 50)}...`);
        continue;
      }

      // Check for duplicates in published articles
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
        metadata: { model: "gpt-4o", message: "All items were duplicates" }
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: "All items were duplicates",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert pending records
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

        // ============================================
        // 7. ARTICLE GENERATION (GPT-4o)
        // ============================================
        const businessArticlePrompt = `You are the StatsGH automated newsroom editor. Your editorial standard combines Daily Mail accessibility with Financial Times accuracy.

STYLE GUIDE:
- Write in plain English that anyone can understand
- Lead with the most important number or fact
- Be data-driven and neutral
- Keep sentences concise and punchy
- Explain jargon when used
- Always attribute claims to sources
- Use active voice

STRICT FORMATTING RULES:
- Do NOT use colons in headlines
- Do NOT use long dashes (—)
- Do NOT use bullet points
- Do NOT use emojis or hashtags
- Do NOT add links or URLs in output
- Use "GHS" for Ghana Cedis (not GHC)
- Use "%" symbol for percentages
- Spell out numbers under 10

ORIGINAL NEWS ITEM:
Headline: ${newsItem.original_headline}
Summary: ${newsItem.original_summary}
Source: ${newsItem.source_name}
URL: ${newsItem.source_url}
Published: ${newsItem.published_at}

TASK:
Transform this into a polished StatsGH article. Expand on the story with context, verify key figures match the original, and ensure accuracy.

OUTPUT (valid JSON only):
{
  "headline": "Compelling headline under 80 characters, no colons",
  "subtitle": "One-sentence expansion of the headline",
  "summary": "Concise 2-3 sentence summary under 400 characters",
  "body": "4-8 HTML paragraphs using <p> tags. Include context, explain why this matters, add relevant background. No links.",
  "seo_description": "SEO meta description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "One of: ${VALID_CATEGORIES.join(", ")}",
  "tags": ["array", "of", "relevant", "tags"],
  "image_prompt": "Visual description for editorial illustration, max 50 words, no text/logos/real people",
  "twitter_post": "Short factual tweet, no emojis or hashtags",
  "instagram_compressed": "Short headline with 'See full article link in bio.'"
}

Return ONLY valid JSON.`;

        const articleResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a professional business journalist. Return only valid JSON. No markdown formatting." },
            { role: "user", content: businessArticlePrompt },
          ],
          max_tokens: 3000,
          temperature: 0.7,
        });

        const articleContent = articleResponse.choices[0]?.message?.content || "";

        let articleJson: any;
        try {
          let jsonStr = articleContent;
          const jsonMatch = articleContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1];
          }
          // Extract JSON object
          const objMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (objMatch) {
            jsonStr = objMatch[0];
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
        // 8. IMAGE GENERATION (DALL-E 3)
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
        // 9. SAVE & PUBLISH
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
      metadata: { model: "gpt-4o", time_window: TIME_WINDOW_HOURS }
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
                      AI Model: gpt-4o<br>
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
      model: "gpt-4o",
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
