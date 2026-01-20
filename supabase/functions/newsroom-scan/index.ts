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
const TIME_WINDOW_HOURS = 24; // Scan last 24 hours but skip already published articles
const MAX_ARTICLES_PER_RUN = 5; // Limit per run to avoid edge function timeout

// Ghana business news sources with RSS feeds
const RSS_SOURCES = [
  { name: "MyJoyOnline", rss: "https://www.myjoyonline.com/feed/", domain: "myjoyonline.com" },
  { name: "Citi Newsroom", rss: "https://citinewsroom.com/feed/", domain: "citinewsroom.com" },
  { name: "Ghana Business News", rss: "https://www.ghanabusinessnews.com/feed/", domain: "ghanabusinessnews.com" },
  { name: "Modern Ghana", rss: "https://www.modernghana.com/rss/", domain: "modernghana.com" },
  { name: "GhanaWeb", rss: "https://www.ghanaweb.com/GhanaHomePage/rss/", domain: "ghanaweb.com" },
  { name: "Graphic Online", rss: "https://www.graphic.com.gh/feed", domain: "graphic.com.gh" },
  { name: "Peace FM Online", rss: "https://www.peacefmonline.com/rss/", domain: "peacefmonline.com" },
  { name: "Pulse Ghana", rss: "https://www.pulse.com.gh/rss", domain: "pulse.com.gh" },
] as const;

// Preferred categories for GPT prompt guidance
const PREFERRED_CATEGORIES = [
  "top-stories",
  "economy-inflation",
  "public-finance",
  "labour-salaries",
  "agriculture-food",
  "energy-resources",
  "trade-investment",
  "health-data",
  "education",
  "infrastructure-transport",
  "security-governance",
  "technology-innovation",
  "environment-climate",
  "population",
  "business",
  "charts-explainers",
  "ghanacrimes",
] as const;

// Default category if GPT returns an invalid slug format
const DEFAULT_CATEGORY = "business";

// Helper to ensure category exists in database, creates if not
async function ensureCategoryExists(supabase: any, slug: string): Promise<string> {
  // Validate slug format (lowercase, hyphens only)
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
  
  if (!cleanSlug || cleanSlug.length < 2) {
    return DEFAULT_CATEGORY;
  }
  
  // Check if category exists
  const { data: existing } = await supabase
    .from("categories")
    .select("slug")
    .eq("slug", cleanSlug)
    .limit(1);
  
  if (existing && existing.length > 0) {
    return cleanSlug;
  }
  
  // Create new category
  const name = cleanSlug
    .split("-")
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  const { error } = await supabase
    .from("categories")
    .insert({
      name,
      slug: cleanSlug,
      description: `Auto-created category for ${name} articles`,
      color: "#262626",
    });
  
  if (error) {
    console.log(`Could not create category ${cleanSlug}, using default: ${error.message}`);
    return DEFAULT_CATEGORY;
  }
  
  console.log(`Created new category: ${cleanSlug}`);
  return cleanSlug;
}

// Business keywords to filter relevant articles
const BUSINESS_KEYWORDS = [
  "economy", "economic", "gdp", "inflation", "cedi", "ghs", "dollar", "forex", "fx",
  "bank", "banking", "bog", "interest rate", "mpc", "monetary",
  "budget", "revenue", "tax", "vat", "gra", "finance", "ministry",
  "oil", "gas", "energy", "fuel", "petrol", "diesel", "electricity", "ecg",
  "cocoa", "gold", "mining", "export", "import", "trade",
  "stock", "gse", "shares", "investment", "investor",
  "debt", "bond", "treasury", "imf", "world bank",
  "company", "business", "profit", "loss", "quarter", "annual",
  "price", "cost", "increase", "decrease", "percent", "%",
  "billion", "million", "thousand", "ghs", "usd", "cedis",
  "government", "parliament", "policy", "regulation",
  "employment", "jobs", "unemployment", "workers",
  "telecoms", "mtn", "vodafone", "airtel", "mobile money",
  "agriculture", "farming", "food", "production",
  "transport", "port", "tema", "shipping", "logistics",
  "real estate", "property", "housing", "construction",
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

// Check if headline/content is business-related
function isBusinessRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BUSINESS_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

// Check if text contains numbers (required for StatsGH)
function containsNumbers(text: string): boolean {
  return /\d+/.test(text);
}

// Parse RSS XML to extract articles
function parseRssXml(xml: string, sourceName: string): Array<{
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source_name: string;
}> {
  const items: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
    source_name: string;
  }> = [];

  // Simple XML parsing for RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    
    // Extract title
    const titleMatch = itemContent.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : "";
    
    // Extract link
    const linkMatch = itemContent.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : "";
    
    // Extract pubDate
    const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
    
    // Extract description
    const descMatch = itemContent.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    let description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : "";
    // Strip HTML tags from description
    description = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        description,
        source_name: sourceName,
      });
    }
  }

  return items;
}

// Fetch RSS feed with timeout
async function fetchRssFeed(url: string, timeout = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StatsGH-Newsroom/1.0 (RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`RSS fetch failed for ${url}: ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.log(`RSS fetch error for ${url}:`, error instanceof Error ? error.message : "Unknown error");
    return null;
  }
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
    // FETCH RSS FEEDS FROM ALL SOURCES
    // ============================================
    const cutoffTime = hoursAgo(TIME_WINDOW_HOURS);
    console.log(`Fetching RSS feeds, cutoff time: ${cutoffTime.toISOString()}`);

    const allArticles: Array<{
      title: string;
      link: string;
      pubDate: string;
      description: string;
      source_name: string;
    }> = [];

    // Fetch all RSS feeds in parallel
    const feedPromises = RSS_SOURCES.map(async (source) => {
      console.log(`Fetching RSS from ${source.name}: ${source.rss}`);
      const xml = await fetchRssFeed(source.rss);
      if (xml) {
        const items = parseRssXml(xml, source.name);
        console.log(`${source.name}: Found ${items.length} items`);
        return items;
      }
      return [];
    });

    const feedResults = await Promise.all(feedPromises);
    feedResults.forEach(items => allArticles.push(...items));

    console.log(`Total RSS items fetched: ${allArticles.length}`);

    // Filter articles by time window and business relevance
    const qualifyingArticles = allArticles.filter(article => {
      // Parse publication date
      let pubDate: Date | null = null;
      try {
        pubDate = new Date(article.pubDate);
        if (isNaN(pubDate.getTime())) pubDate = null;
      } catch {
        pubDate = null;
      }

      // Skip if no valid date or too old
      if (!pubDate || pubDate < cutoffTime) {
        return false;
      }

      // Check if business-related
      const fullText = `${article.title} ${article.description}`;
      if (!isBusinessRelated(fullText)) {
        return false;
      }

      // Check if contains numbers
      if (!containsNumbers(fullText)) {
        return false;
      }

      return true;
    });

    console.log(`Qualifying business articles: ${qualifyingArticles.length}`);

    // ============================================
    // FAILSAFE: No qualifying stories
    // ============================================
    if (qualifyingArticles.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "no_news",
        completed_at: new Date().toISOString(),
        metadata: { 
          method: "rss-feeds", 
          sources_checked: RSS_SOURCES.length,
          time_window: TIME_WINDOW_HOURS,
          message: `No new qualifying Ghana business stories in the last ${TIME_WINDOW_HOURS} hours.`
        }
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: `No new qualifying Ghana business stories in the last ${TIME_WINDOW_HOURS} hours.`,
        sources_checked: RSS_SOURCES.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate using headline-based key
    const deduped: typeof qualifyingArticles = [];
    for (const article of qualifyingArticles) {
      const dateStr = new Date(article.pubDate).toISOString().split("T")[0];
      const dedupeKeyRaw = buildDedupeKey(article.title, article.source_name, dateStr, []);
      const dedupeKeyHash = await sha256Hex(dedupeKeyRaw);

      // Check for duplicates in newsroom_articles
      const { data: seen } = await supabase
        .from("newsroom_articles")
        .select("id")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seen && seen.length > 0) {
        console.log(`Skipping duplicate (newsroom): ${article.title.substring(0, 50)}...`);
        continue;
      }

      // Check for duplicates in published articles
      const { data: seenPublished } = await supabase
        .from("articles")
        .select("id")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seenPublished && seenPublished.length > 0) {
        console.log(`Skipping duplicate (articles): ${article.title.substring(0, 50)}...`);
        continue;
      }

      (article as any)._dedupe_key = dedupeKeyHash;
      (article as any)._dedupe_key_raw = dedupeKeyRaw;
      deduped.push(article);
    }

    console.log(`After deduplication: ${deduped.length} new items`);

    if (deduped.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "no_news",
        completed_at: new Date().toISOString(),
        metadata: { method: "rss-feeds", message: "All items were duplicates" }
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        message: "All items were duplicates",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit to max 10 articles per run to avoid timeout
    const toProcess = deduped.slice(0, 10);

    // Insert pending records
    const newsRecords = toProcess.map((item: any) => ({
      run_id: run.id,
      source_name: item.source_name,
      original_headline: item.title,
      original_summary: item.description || "",
      source_url: item.link,
      published_at: new Date(item.pubDate).toISOString(),
      category_hint: null,
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
    const itemsToProcess = (insertedNews || []).slice(0, MAX_ARTICLES_PER_RUN);

    for (const newsItem of itemsToProcess) {
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
        const articlePrompt = `You are the StatsGH automated newsroom editor. StatsGH is a DATA-DRIVEN news platform - EVERY article MUST contain meaningful numbers.

ORIGINAL NEWS ITEM:
Headline: ${newsItem.original_headline}
Summary: ${newsItem.original_summary}
Source: ${newsItem.source_name}
URL: ${newsItem.source_url}
Published: ${newsItem.published_at}

ABSOLUTE REQUIREMENT - NUMBERS ARE MANDATORY:
This is a numbers-crunching website. Articles WITHOUT specific numbers are UNACCEPTABLE.

IF the source story contains numbers (amounts, %, rates, counts):
- Extract and highlight ALL numbers from the source.

IF the source story lacks numbers (e.g., diplomatic visits, appointments, ceremonies):
- You MUST add COMPARATIVE CONTEXT DATA from your knowledge:
  - For country relations: Compare GDP, population, trade volumes, bilateral trade value between Ghana and the other country
  - For appointments/governance: Include relevant budget figures, department size, historical spending
  - For international events: Include economic indicators of countries involved
  - For policy announcements: Include baseline statistics the policy aims to change
- Example: A VP visiting Guinea should include Ghana vs Guinea GDP ($77B vs $16B), population (33M vs 14M), bilateral trade figures
- State these as "For context:" to distinguish from source facts

OUTPUT STYLE RULES:
- Write in simple, plain English that a reader with basic English can understand.
- Short sentences. Clear subject and verb. Neutral tone.
- No emojis. No hashtags. No long dashes. No bullet symbols.
- Do not include any URLs inside the article body or tweet.
- Use GHS for Ghana cedi amounts.
- Use % for percentages.

FACT INTEGRITY:
- Clearly distinguish source facts from contextual data you add.
- For added context, use phrases like "For context," or "Ghana's economy..."
- Never present added context as if it came from the source.

ARTICLE STRUCTURE - Generate this exact structure:

HEADLINE: One short line, factual, interesting, max 80 characters.

ARTICLE:
- Paragraph 1 explains what happened and why it matters.
- Paragraph 2 adds context in simple terms.

KEY NUMBERS AT A GLANCE:
- MINIMUM 3 number lines required. This section CANNOT be empty.
- If source lacks numbers, add comparative/contextual data.
- Each line must include a specific number, amount, or %.
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
  "key_numbers": ["MINIMUM 3 items required - Array of number lines, e.g. 'Ghana GDP: $77 billion', 'Guinea GDP: $16 billion', 'Bilateral trade: $45 million'"],
  "numbers_explanation": "2-3 short paragraphs explaining what the numbers mean in real life",
  "takeaway": "One clear takeaway sentence",
  "tweet": "One sentence with at least one number, no URLs",
  "source_url": "${newsItem.source_url}",
  "seo_description": "SEO meta description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "A category slug like: ${PREFERRED_CATEGORIES.join(", ")} - or suggest a new one in kebab-case",
  "tags": ["array", "of", "relevant", "tags"],
  "image_prompt": "Visual description for editorial illustration, max 50 words, no text/logos/real people",
  "has_source_numbers": true or false (whether the original source contained numbers),
  "context_added": true or false (whether you added comparative/contextual data)
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

        // ============================================
        // VALIDATE NUMBERS REQUIREMENT (EDITORIAL STANDARD)
        // ============================================
        const keyNumbers = Array.isArray(articleJson.key_numbers) ? articleJson.key_numbers : [];
        
        // Filter out empty entries and entries saying "not provided" or similar
        const validKeyNumbers = keyNumbers.filter((n: string) => {
          if (!n || typeof n !== 'string') return false;
          const lower = n.toLowerCase();
          if (lower.includes('not provided') || lower.includes('no specific') || lower.includes('not available')) return false;
          // Must contain at least one digit
          return /\d/.test(n);
        });

        if (validKeyNumbers.length < 3) {
          console.log(`REJECTED: Article "${articleJson.headline}" has only ${validKeyNumbers.length} valid numbers (minimum 3 required)`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `Editorial rejection: Only ${validKeyNumbers.length} valid numbers found (minimum 3 required for StatsGH)`,
          }).eq("id", newsItem.id);
          continue; // Skip this article
        }

        console.log(`Numbers validation passed: ${validKeyNumbers.length} valid numbers found`);
        if (articleJson.context_added) {
          console.log(`Note: Contextual data was added to enrich this article`);
        }

        // Build the article body in the master prompt structure
        const keyNumbersHtml = validKeyNumbers.map((n: string) => `<p>${n}</p>`).join("\n");
        
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

        // Ensure category exists in database (create if new)
        const section = await ensureCategoryExists(supabase, articleJson.section || DEFAULT_CATEGORY);

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
        
        // Update run progress incrementally to prevent data loss on timeout
        await supabase.from("newsroom_runs").update({
          articles_created: articlesCreated,
        }).eq("id", run.id);
        
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
      metadata: { method: "rss-feeds", sources_checked: RSS_SOURCES.length, time_window: TIME_WINDOW_HOURS }
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
                      Method: RSS Feed Ingestion<br>
                      Sources checked: ${RSS_SOURCES.length} Ghana news sources<br>
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
      method: "rss-feeds",
      sources_checked: RSS_SOURCES.length,
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
