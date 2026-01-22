import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

const DEFAULT_CATEGORY = "business";

// Generate AI image using Lovable AI (Gemini)
async function generateAiImage(
  prompt: string,
  supabase: any,
  articleSlug: string
): Promise<string | null> {
  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.log('LOVABLE_API_KEY not configured, skipping AI image');
      return null;
    }
    
    console.log(`Generating AI image for: ${articleSlug}`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: `Generate a photorealistic, professional editorial photograph for a news article. 
Style: Documentary journalism, high quality, 16:9 aspect ratio, professional lighting.
Subject: ${prompt}
Requirements: No text, no logos, no watermarks, no AI-looking faces. 
The image should look like it was taken by a professional photojournalist in Ghana or Africa.`
          }
        ],
        modalities: ['image', 'text']
      })
    });
    
    if (!response.ok) {
      console.log(`AI image generation failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData || !imageData.startsWith('data:image')) {
      console.log('No valid image in AI response');
      return null;
    }
    
    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.log('Could not parse AI image data');
      return null;
    }
    
    const [, format, base64Data] = base64Match;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const ext = format === 'png' ? 'png' : 'jpg';
    const contentType = `image/${format === 'png' ? 'png' : 'jpeg'}`;
    const imagePath = `newsroom/${articleSlug}-${Date.now()}-ai.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { contentType, upsert: true });
    
    if (uploadError) {
      console.error('AI image upload error:', uploadError);
      return null;
    }
    
    const { data: publicUrl } = supabase.storage
      .from('media')
      .getPublicUrl(imagePath);
    
    console.log(`AI image generated and uploaded: ${publicUrl.publicUrl}`);
    return publicUrl.publicUrl;
  } catch (error) {
    console.log(`AI image error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

// Helper to ensure category exists in database
async function ensureCategoryExists(supabase: any, slug: string): Promise<string> {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
  
  if (!cleanSlug || cleanSlug.length < 2) {
    return DEFAULT_CATEGORY;
  }
  
  const { data: existing } = await supabase
    .from("categories")
    .select("slug")
    .eq("slug", cleanSlug)
    .limit(1);
  
  if (existing && existing.length > 0) {
    return cleanSlug;
  }
  
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

// Fetch URL content if input is a URL
async function fetchUrlContent(url: string): Promise<{ title: string; content: string; sourceUrl: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StatsGH-Manual-Submit/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch URL: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    // Extract main content (strip HTML tags)
    let content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000); // Limit content length
    
    return { title, content, sourceUrl: url };
  } catch (error) {
    console.error("Error fetching URL:", error);
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

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "editor"])
      .maybeSingle();
    
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { input, scheduled_at } = body;
    
    if (!input || typeof input !== "string" || input.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Please provide article content (URL or text, minimum 20 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Handle scheduling: "auto" for system-picked time, ISO string for manual, null for immediate
    let scheduledDateTime: Date | null = null;
    const isAutoSchedule = scheduled_at === "auto";
    
    if (isAutoSchedule) {
      // Auto-schedule: pick next optimal slot
      // Strategy: stagger articles throughout the day at peak engagement times
      const now = new Date();
      const peakHours = [7, 9, 12, 15, 18, 20]; // Morning, mid-morning, lunch, afternoon, evening, night
      
      // Find articles scheduled for today to avoid conflicts
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      
      const { data: scheduledToday } = await supabase
        .from("articles")
        .select("scheduled_at")
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .not("scheduled_at", "is", null);
      
      const takenHours = new Set(
        (scheduledToday || [])
          .map(a => new Date(a.scheduled_at!).getHours())
      );
      
      // Find next available peak hour
      const currentHour = now.getHours();
      let selectedDate = new Date(now);
      let foundSlot = false;
      
      // Check today's remaining peak hours
      for (const hour of peakHours) {
        if (hour > currentHour && !takenHours.has(hour)) {
          selectedDate.setHours(hour, 0, 0, 0);
          foundSlot = true;
          break;
        }
      }
      
      // If no slot today, schedule for tomorrow's first peak hour
      if (!foundSlot) {
        selectedDate.setDate(selectedDate.getDate() + 1);
        selectedDate.setHours(peakHours[0], 0, 0, 0);
      }
      
      scheduledDateTime = selectedDate;
      console.log(`Auto-scheduled for: ${scheduledDateTime.toISOString()}`);
    } else if (scheduled_at) {
      scheduledDateTime = new Date(scheduled_at);
      if (isNaN(scheduledDateTime.getTime())) {
        return new Response(JSON.stringify({ error: "Invalid scheduled date format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (scheduledDateTime <= new Date()) {
        return new Response(JSON.stringify({ error: "Scheduled time must be in the future" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`Manually scheduled for: ${scheduledDateTime.toISOString()}`);
    }

    const inputTrimmed = input.trim();
    
    // Determine if input is URL or raw text
    const isUrl = /^https?:\/\//i.test(inputTrimmed);
    
    let articleSource: { headline: string; content: string; sourceUrl: string | null };
    
    if (isUrl) {
      console.log(`Fetching content from URL: ${inputTrimmed}`);
      const urlContent = await fetchUrlContent(inputTrimmed);
      
      if (!urlContent) {
        return new Response(JSON.stringify({ error: "Failed to fetch content from URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      articleSource = {
        headline: urlContent.title,
        content: urlContent.content,
        sourceUrl: urlContent.sourceUrl,
      };
    } else {
      // Raw text input - extract first line as potential headline
      const lines = inputTrimmed.split('\n').filter(l => l.trim());
      const firstLine = lines[0] || "";
      const rest = lines.slice(1).join('\n');
      
      articleSource = {
        headline: firstLine.length < 150 ? firstLine : "",
        content: inputTrimmed,
        sourceUrl: null,
      };
    }

    console.log(`Processing article: "${articleSource.headline.substring(0, 50)}..."`);

    // ============================================
    // MASTER ARTICLE GENERATION PROMPT
    // ============================================
    const articlePrompt = `You are the StatsGH automated newsroom editor. StatsGH is a DATA-DRIVEN news platform - EVERY article MUST contain meaningful numbers.

ORIGINAL NEWS ITEM:
Headline: ${articleSource.headline}
Content: ${articleSource.content.substring(0, 12000)}
${articleSource.sourceUrl ? `Source URL: ${articleSource.sourceUrl}` : "Source: Manual submission"}

CRITICAL INSTRUCTION - PRESERVE FULL CONTENT:
If the source contains a LISTING, RANKING, or ENUMERATED content (e.g., "Top 10...", "Best...", numbered items):
- You MUST preserve ALL items from the list with their details and prices/numbers.
- Do NOT summarize or condense the list. The listing IS the article.
- Format each list item as a separate section with heading.

NUMBERS ARE MANDATORY:
This is a numbers-crunching website. Articles WITHOUT specific numbers are UNACCEPTABLE.

IF the source story contains numbers (amounts, %, rates, counts, prices):
- Extract and preserve ALL numbers from the source.

IF the source story lacks numbers:
- Add COMPARATIVE CONTEXT DATA from your knowledge.

OUTPUT STYLE RULES:
- Write in simple, plain English.
- Short sentences. Clear subject and verb. Neutral tone.
- No emojis. No hashtags. No long dashes.
- Do not include any URLs inside the article body or tweet.
- Use GHS for Ghana cedi amounts.
- Use % for percentages.

OUTPUT (valid JSON only):
{
  "headline": "Max 80 characters, factual, no colons",
  "subtitle": "One-sentence expansion of the headline",
  "article_body_html": "FULL HTML article body. For lists/rankings, preserve ALL items as <h3> headings with <p> descriptions. Include an intro paragraph, then ALL list items with their details, then a conclusion. Use <h3> for item titles, <p> for details. MUST include ALL items from the source.",
  "tweet": "One sentence with at least one number, no URLs",
  "source_url": "${articleSource.sourceUrl || ""}",
  "seo_description": "SEO meta description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "A category slug like: ${PREFERRED_CATEGORIES.join(", ")} - or suggest a new one in kebab-case",
  "tags": ["array", "of", "relevant", "tags"],
  "image_prompt": "Visual description for editorial illustration, max 50 words",
  "key_numbers_count": number of distinct numbers/prices in the article (for validation)
}

IMPORTANT: The "article_body_html" field must contain the COMPLETE article with ALL content from the source. For listings, this means ALL 10 items if there are 10, ALL prices, ALL details. Do not summarize.

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
      return new Response(JSON.stringify({ error: "Failed to generate article - invalid AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate numbers requirement
    const keyNumbersCount = Number(articleJson.key_numbers_count) || 0;
    
    // Check article body for numbers as backup validation
    const bodyText = String(articleJson.article_body_html || "");
    const numbersInBody = (bodyText.match(/\d[\d,\.]*\d|\d/g) || []).length;
    
    if (keyNumbersCount < 3 && numbersInBody < 3) {
      return new Response(JSON.stringify({ 
        error: `Editorial rejection: Only ${Math.max(keyNumbersCount, numbersInBody)} numbers found (minimum 3 required for StatsGH)`,
        details: "The source content doesn't have enough numerical data."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Numbers validation passed: ${Math.max(keyNumbersCount, numbersInBody)} numbers found`);

    // Use the full article body HTML from GPT
    const articleBody = String(articleJson.article_body_html || "").trim();

    const slugBase = String(articleJson.slug || articleJson.headline || "article")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 80);

    const articleSlug = `${slugBase}-${Date.now()}`;

    // Ensure category exists first
    const categorySlug = await ensureCategoryExists(supabase, articleJson.section || DEFAULT_CATEGORY);
    
    // Generate AI image for the article
    let heroImageUrl: string | null = null;
    
    try {
      console.log(`Generating AI image for: ${articleSlug}`);
      const imagePrompt = `Professional editorial photograph: ${articleJson.headline}. African business context, Ghana, documentary style.`;
      heroImageUrl = await generateAiImage(imagePrompt, supabase, articleSlug);
      
      if (heroImageUrl) {
        console.log(`AI image generated: ${heroImageUrl}`);
      } else {
        console.log(`AI image generation failed for: ${articleSlug}`);
      }
    } catch (imgError) {
      console.error("Image generation error:", imgError);
    }

    // Get category ID
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    const categoryId = categoryRow?.id || null;

    // Determine if this is a scheduled or immediate publish
    const isScheduled = scheduledDateTime !== null;
    
    // Insert article
    const { data: newArticle, error: insertError } = await supabase
      .from("articles")
      .insert({
        title: String(articleJson.headline || "Untitled").substring(0, 200),
        slug: articleSlug,
        body: articleBody,
        summary: String(articleJson.subtitle || "").substring(0, 500),
        hero_image_url: heroImageUrl,
        category_id: categoryId,
        category_slug: categorySlug,
        author_id: user.id,
        author_name: "StatsGH Newsroom",
        section: categorySlug,
        status: isScheduled ? "scheduled" : "published",
        is_published: !isScheduled,
        published_at: isScheduled ? null : new Date().toISOString(),
        scheduled_at: isScheduled && scheduledDateTime ? scheduledDateTime.toISOString() : null,
        meta_title: String(articleJson.headline || "").substring(0, 60),
        seo_description: String(articleJson.seo_description || "").substring(0, 155),
        twitter_post: String(articleJson.tweet || "").substring(0, 280),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Article insert error:", insertError);
      return new Response(JSON.stringify({ error: `Failed to save article: ${insertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Article ${isScheduled ? 'scheduled' : 'published'}: ${newArticle.id} - ${newArticle.title}`);

    return new Response(JSON.stringify({
      success: true,
      article: {
        id: newArticle.id,
        title: newArticle.title,
        slug: newArticle.slug,
        category: categorySlug,
        url: `/${categorySlug}/${newArticle.slug}`,
      },
      scheduled: isScheduled,
      scheduled_at: isScheduled && scheduledDateTime ? scheduledDateTime.toISOString() : null,
      context_added: articleJson.context_added || false,
      tweet: articleJson.tweet,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Manual article submit error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
