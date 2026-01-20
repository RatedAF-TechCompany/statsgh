import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================
// STATSGH NEWSROOM MASTER CONFIGURATION
// ============================================
const TIME_WINDOW_HOURS = 4; // Run every 4 hours

// 20 Ghana business news sources
const NEWS_SOURCES = [
  { name: "Business and Financial Times", domain: "thebftonline.com" },
  { name: "Graphic Online", domain: "graphic.com.gh" },
  { name: "MyJoyOnline", domain: "myjoyonline.com" },
  { name: "Citi Newsroom", domain: "citinewsroom.com" },
  { name: "Ghana Business News", domain: "ghanabusinessnews.com" },
  { name: "BusinessGhana", domain: "businessghana.com" },
  { name: "Ghana News Agency", domain: "gna.org.gh" },
  { name: "Peace FM Online", domain: "peacefmonline.com" },
  { name: "Modern Ghana", domain: "modernghana.com" },
  { name: "GhanaWeb", domain: "ghanaweb.com" },
  { name: "Pulse Ghana", domain: "pulse.com.gh" },
  { name: "Business Day Ghana", domain: "businessdayghana.com" },
  { name: "Ministry of Finance", domain: "mofep.gov.gh" },
  { name: "Bank of Ghana", domain: "bog.gov.gh" },
  { name: "Ghana Stock Exchange", domain: "gse.com.gh" },
  { name: "Ghana Statistical Service", domain: "gss.gov.gh" },
  { name: "Energy Ministry", domain: "energymin.gov.gh" },
  { name: "Ghana Revenue Authority", domain: "gra.gov.gh" },
  { name: "National Development Planning Commission", domain: "ndpc.gov.gh" },
  { name: "Cedi Talk", domain: "ceditalk.com" },
] as const;

// Business categories for classification
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

// Image styles (rotate between these)
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
// HELPERS
// ============================================
function nowUtc(): Date {
  return new Date();
}

function hoursAgo(hours: number): Date {
  return new Date(nowUtc().getTime() - hours * 60 * 60 * 1000);
}

// Build dedupe key following master prompt rules:
// event core + primary organisation + date + top numbers
// Normalized: lowercase, no punctuation, collapsed spaces
function buildDedupeKey(eventCore: string, org: string, dateStr: string, numbers: string[]): string {
  const parts = [eventCore, org, dateStr, ...numbers.slice(0, 3)];
  const combined = parts.join(" ");
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    // STATSGH MASTER SEARCH PROMPT
    // ============================================
    const currentTime = new Date().toISOString();
    const sourcesList = NEWS_SOURCES.map((s) => `${s.name} (${s.domain})`).join("\n");
    
    const searchPrompt = `You are the StatsGH automated newsroom scanner for Ghana business news.

CURRENT DATE/TIME: ${currentTime}
SCAN WINDOW: Last ${TIME_WINDOW_HOURS} hours (since ${hoursAgo(TIME_WINDOW_HOURS).toISOString()})

SOURCES TO SCAN (business/economy/finance sections):
${sourcesList}

WHAT COUNTS AS A QUALIFYING STORY:
Business and economy only. Examples include taxes, VAT, inflation, FX, debt, budget, energy, banking, trade, company performance, jobs, prices, ports, cocoa, gold, oil, telecoms, transport, major public procurement, major regulatory actions.

Prioritise stories that contain at least one clear number such as a GHS amount, USD amount, %, target, date, time period, volume, headcount, rate, or comparison.

DO NOT INVENT FACTS:
Only use numbers and claims stated in the source story. If a key detail is missing or unclear, note that it was not provided.

DEDUPLICATION RULES:
Treat the same underlying event as one story, even if multiple sites publish it.
To detect duplicates, create a DEDUPE KEY using these steps:
1. Extract the event core as a short phrase: who did what, to what, where, and when.
2. Extract the top 3 numbers in the story, if any.
3. Build the key as: event core + primary organisation name + date mentioned or publication date + top numbers
4. Normalise by lowercasing, removing punctuation, and collapsing spaces.

Return a valid JSON array of 5 to 15 unique qualifying items. Each item MUST include:
{
  "source_name": "Exact source name from list",
  "original_headline": "The actual headline as published",
  "original_summary": "2-3 sentence summary with key figures. Do not invent facts.",
  "source_url": "Full URL to the article",
  "published_at": "ISO 8601 timestamp",
  "category_hint": "One of: ${VALID_CATEGORIES.join(", ")}",
  "event_core": "Short phrase: who did what, to what, where, when",
  "primary_org": "Main organisation involved",
  "key_numbers": ["Array of top 3 numbers/percentages from the story"],
  "dedupe_key": "Normalized dedupe key built from above"
}

CRITICAL RULES:
- Only include stories published within the last ${TIME_WINDOW_HOURS} hours
- Only include business/economy stories with at least one clear number
- Do not repeat the same event from different sources
- If no qualifying stories exist, return an empty array []

Return ONLY valid JSON array, no markdown, no explanation.`;

    console.log("Calling OpenAI GPT-4o for news search...");
    
    const newsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional news researcher. Return only valid JSON arrays. No markdown formatting." },
        { role: "user", content: searchPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.5,
    });

    const newsContent = newsResponse.choices[0]?.message?.content || "";

    let newsItems: any[] = [];
    try {
      let jsonStr = newsContent;
      const jsonMatch = newsContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
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
      const keyNumbers = Array.isArray(item.key_numbers) ? item.key_numbers : [];
      
      if (!sourceName || !headline) {
        console.log(`Skipped: missing sourceName or headline`);
        continue;
      }
      
      // Validate source name matches our list
      const matchedSource = NEWS_SOURCES.find((s) => 
        s.name.toLowerCase() === sourceName.toLowerCase() ||
        sourceName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]) ||
        sourceName.toLowerCase().includes(s.domain.replace('.com', '').replace('.gh', '').replace('.org', '').replace('.gov', ''))
      );
      
      if (!matchedSource) {
        console.log(`Skipped: unrecognized source "${sourceName}"`);
        continue;
      }

      // Require at least one number
      if (keyNumbers.length === 0 && !headline.match(/\d+/)) {
        console.log(`Skipped: no numbers found in "${headline.substring(0, 50)}..."`);
        continue;
      }
      
      console.log(`Accepted: "${headline.substring(0, 60)}..." from ${matchedSource.name}`);
      filtered.push({
        ...item,
        source_name: matchedSource.name,
      });
    }

    console.log(`After filtering: ${filtered.length} qualifying items`);

    // ============================================
    // FAILSAFE: No qualifying stories
    // ============================================
    if (filtered.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "no_news",
        completed_at: new Date().toISOString(),
        metadata: { 
          model: "gpt-4o", 
          time_window: TIME_WINDOW_HOURS,
          message: `No new qualifying Ghana business stories in the last ${TIME_WINDOW_HOURS} hours.`
        }
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: `No new qualifying Ghana business stories in the last ${TIME_WINDOW_HOURS} hours.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate using the new key format
    const deduped: any[] = [];
    for (const item of filtered) {
      const eventCore = String(item.event_core || item.original_headline || "");
      const primaryOrg = String(item.primary_org || "");
      const dateStr = String(item.published_at || new Date().toISOString()).split("T")[0];
      const keyNumbers = Array.isArray(item.key_numbers) ? item.key_numbers.map(String) : [];
      
      const dedupeKeyRaw = item.dedupe_key || buildDedupeKey(eventCore, primaryOrg, dateStr, keyNumbers);
      const dedupeKeyHash = await sha256Hex(dedupeKeyRaw);

      // Check for duplicates in newsroom_articles
      const { data: seen } = await supabase
        .from("newsroom_articles")
        .select("id")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seen && seen.length > 0) {
        console.log(`Skipping duplicate (newsroom): ${item.original_headline?.substring(0, 50)}...`);
        continue;
      }

      // Check for duplicates in published articles
      const { data: seenPublished } = await supabase
        .from("articles")
        .select("id")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seenPublished && seenPublished.length > 0) {
        console.log(`Skipping duplicate (articles): ${item.original_headline?.substring(0, 50)}...`);
        continue;
      }

      item._dedupe_key = dedupeKeyHash;
      item._dedupe_key_raw = dedupeKeyRaw;
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
    // PROCESS EACH ITEM INTO STATSGH ARTICLE FORMAT
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
        // MASTER ARTICLE GENERATION PROMPT
        // ============================================
        const articlePrompt = `You are the StatsGH automated newsroom editor.

ORIGINAL NEWS ITEM:
Headline: ${newsItem.original_headline}
Summary: ${newsItem.original_summary}
Source: ${newsItem.source_name}
URL: ${newsItem.source_url}
Published: ${newsItem.published_at}

OUTPUT STYLE RULES:
- Write in simple, plain English that a reader with basic English can understand.
- Short sentences. Clear subject and verb. Neutral tone.
- No emojis. No hashtags. No long dashes. No bullet symbols.
- Do not include any URLs inside the article body or tweet.
- Use GHS for Ghana cedi amounts.
- Use % for percentages.

DO NOT INVENT FACTS:
Only use numbers and claims stated in the source story. If a key detail is missing or unclear, state that it was not provided in the report.

ARTICLE STRUCTURE - Generate this exact structure:

HEADLINE: One short line, factual, interesting, max 80 characters.

ARTICLE:
- Paragraph 1 explains what happened and why it matters.
- Paragraph 2 adds context in simple terms.

KEY NUMBERS AT A GLANCE:
- List only numbers that appear in the story.
- Each line must include a number or %.
- Keep each line short.
- Use plain lines with no bullets.

Then write 2 to 3 short paragraphs explaining what the numbers mean in real life.

End with one clear takeaway sentence.

TWEET: One sentence only. Must contain at least one number from the story. No URLs.

OUTPUT (valid JSON only):
{
  "headline": "Max 80 characters, factual, no colons",
  "subtitle": "One-sentence expansion of the headline",
  "article_intro": "Paragraph 1: what happened and why it matters",
  "article_context": "Paragraph 2: context in simple terms",
  "key_numbers": ["Array of number lines from the story, e.g. '1.9% average price drop'"],
  "numbers_explanation": "2-3 short paragraphs explaining what the numbers mean in real life",
  "takeaway": "One clear takeaway sentence",
  "tweet": "One sentence with at least one number, no URLs",
  "source_url": "${newsItem.source_url}",
  "seo_description": "SEO meta description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "One of: ${VALID_CATEGORIES.join(", ")}",
  "tags": ["array", "of", "relevant", "tags"],
  "image_prompt": "Visual description for editorial illustration, max 50 words, no text/logos/real people"
}

Return ONLY valid JSON.`;

        const articleResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a professional business journalist. Return only valid JSON. No markdown formatting." },
            { role: "user", content: articlePrompt },
          ],
          max_tokens: 3000,
          temperature: 0.5,
        });

        const articleContent = articleResponse.choices[0]?.message?.content || "";

        let articleJson: any;
        try {
          let jsonStr = articleContent;
          const jsonMatch = articleContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1];
          }
          const objMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (objMatch) {
            jsonStr = objMatch[0];
          }
          articleJson = JSON.parse(jsonStr);
        } catch {
          throw new Error("Failed to parse article JSON");
        }

        // Build the article body in the master prompt structure
        const keyNumbersHtml = Array.isArray(articleJson.key_numbers) 
          ? articleJson.key_numbers.map((n: string) => `<p>${n}</p>`).join("\n")
          : "";
        
        const articleBody = `
<p>${articleJson.article_intro || ""}</p>
<p>${articleJson.article_context || ""}</p>
<h3>Key Numbers at a Glance</h3>
${keyNumbersHtml}
<p>${articleJson.numbers_explanation || ""}</p>
<p><strong>${articleJson.takeaway || ""}</strong></p>
`.trim();

        const slugBase = String(articleJson.slug || articleJson.headline || "article")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .substring(0, 80);

        const articleSlug = `${slugBase}-${Date.now()}`;

        // ============================================
        // IMAGE GENERATION (DALL-E 3)
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

        // Build summary from the intro
        let summary = articleJson.article_intro || articleJson.subtitle || "";
        if (summary.length > 400) {
          summary = summary.substring(0, 397) + "...";
        }
        let seoDescription = articleJson.seo_description || "";
        if (seoDescription.length > 155) {
          seoDescription = seoDescription.substring(0, 152) + "...";
        }

        // ============================================
        // SAVE & PUBLISH
        // ============================================
        const { data: newArticle, error: articleError } = await supabase
          .from("articles")
          .insert({
            title: articleJson.headline,
            subtitle: articleJson.subtitle,
            summary: summary,
            body: articleBody,
            slug: articleSlug,
            category_slug: section,
            section: section,
            author_name: "StatsGH Newsroom",
            tags: Array.isArray(articleJson.tags) ? articleJson.tags : [],
            seo_description: seoDescription,
            twitter_post: articleJson.tweet,
            instagram_comment: "See full article link in bio.",
            instagram_compressed: articleJson.headline,
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
                      Trigger: ${triggerType === "scheduled" ? "Scheduled scan (every 4 hours)" : "Manual scan"}<br>
                      AI Model: gpt-4o + DALL-E 3<br>
                      Sources scanned: 20 Ghana business sources<br>
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
