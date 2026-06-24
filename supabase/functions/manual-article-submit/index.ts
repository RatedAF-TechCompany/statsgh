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
  "macroeconomy",
  "markets",
  "public-finance",
  "banking-and-finance",
  "energy-and-utilities",
  "trade-and-industry",
  "corporate-ghana",
  "agriculture-and-commodities",
  "infrastructure-and-transport",
  "data-and-research",
  "regulation-and-policy",
  "technology-and-digital-economy",
  "labour-and-jobs",
  "regional-economy",
] as const;

const DEFAULT_CATEGORY = "macroeconomy";

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
            content: `Create a photograph that looks exactly like a real editorial photo from a wire service such as Reuters or AFP.

SUBJECT: ${prompt}

MANDATORY STYLE:
- Must be indistinguishable from a real photograph taken by a professional photojournalist
- Documentary journalism style, natural ambient lighting, low saturation
- 16:9 aspect ratio, clean composition, no dramatic filters or cinematic effects
- Calm, neutral, observational tone — like Financial Times or The Economist photography

WHAT TO DEPICT (choose the most fitting):
- Real environments: government buildings, offices, farms, factories, ports, markets, streets, skylines
- Objects and commodities: documents, produce, machinery, currency, equipment
- Wide establishing shots of cities, institutions, or landscapes
- Anonymous workers or crowds seen from a distance or from behind (no close-up faces)

STRICTLY FORBIDDEN:
- No identifiable faces or named individuals
- No digital art, concept art, illustrations, infographics, or stylised visuals
- No text overlays, logos, watermarks, or labels
- No staged political scenes or fake press conferences
- No abstract or symbolic imagery
- No dramatic lighting, lens flare, or HDR effects
- The result must NOT look AI-generated in any way

FINAL CHECK: Would this image feel completely normal on the front page of the Financial Times? If not, make it more restrained and documentary.`
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
    const { input, scheduled_at, custom_title, hero_image_url: userProvidedImage } = body;
    
    // Extract author attribution from input (e.g., "by Citizen Yao" or "by John Doe")
    // Pattern: look for "by [Name]" at start or end of input, or after a period/newline
    let extractedAuthor: string | null = null;
    const authorPatterns = [
      /\bby\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s*$/i,  // "by Name" at end
      /^\s*by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s*[\n.]/i,  // "by Name" at start
      /[\n.]\s*by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s*$/i,  // "by Name" after newline/period at end
    ];
    
    for (const pattern of authorPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        extractedAuthor = match[1].trim();
        console.log(`Extracted author from input: "${extractedAuthor}"`);
        break;
      }
    }
    
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
      // Rules:
      // 1. Max 4 auto-scheduled articles per day
      // 2. No duplicate time slots
      // 3. If day is full (4 articles), skip next day and schedule for day after
      const now = new Date();
      const peakHours = [7, 9, 12, 15, 18, 20]; // 6 peak hours, but max 4 per day
      const MAX_PER_DAY = 4;
      
      // Helper to get scheduled articles for a specific day
      const getScheduledForDay = async (date: Date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const { data } = await supabase
          .from("articles")
          .select("scheduled_at")
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString())
          .not("scheduled_at", "is", null);
        
        return data || [];
      };
      
      // Helper to find next available slot on a given day
      const findSlotOnDay = (date: Date, scheduledArticles: any[], afterHour: number = -1): Date | null => {
        if (scheduledArticles.length >= MAX_PER_DAY) {
          return null; // Day is full
        }
        
        const takenHours = new Set(
          scheduledArticles.map(a => new Date(a.scheduled_at!).getHours())
        );
        
        for (const hour of peakHours) {
          if (hour > afterHour && !takenHours.has(hour)) {
            const slot = new Date(date);
            slot.setHours(hour, 0, 0, 0);
            return slot;
          }
        }
        
        return null; // No available slots
      };
      
      let selectedDate: Date | null = null;
      let daysChecked = 0;
      let currentCheckDate = new Date(now);
      const currentHour = now.getHours();
      
      while (!selectedDate && daysChecked < 14) { // Check up to 2 weeks ahead
        const scheduledForDay = await getScheduledForDay(currentCheckDate);
        
        // For today, only consider hours after current time
        const afterHour = daysChecked === 0 ? currentHour : -1;
        
        const slot = findSlotOnDay(currentCheckDate, scheduledForDay, afterHour);
        
        if (slot) {
          selectedDate = slot;
        } else {
          // Day is full or no slots available
          // Skip to day after next (leave a gap)
          daysChecked++;
          currentCheckDate.setDate(currentCheckDate.getDate() + 2); // Skip a day
          daysChecked++; // Count the skipped day too
        }
      }
      
      // Fallback: if somehow no slot found, schedule for 2 weeks from now
      if (!selectedDate) {
        selectedDate = new Date(now);
        selectedDate.setDate(selectedDate.getDate() + 14);
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
  "seo_description": "SEO meta description — HARD MAX 140 characters, full sentence ending with period",
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
    
    // ============================================
    // IMAGE SELECTION: Known Person Override → AI-Generated
    // ============================================
    let heroImageUrl: string | null = null;
    
    // PRIORITY 0: Known image overrides (curated authentic photos & institution logos)
    const KNOWN_IMAGE_OVERRIDES: Record<string, string> = {
      "cheddar": "https://statsgh.lovable.app/images/cheddar-nana-kwame-bediako.jpeg",
      "nana kwame bediako": "https://statsgh.lovable.app/images/cheddar-nana-kwame-bediako.jpeg",
      "alfredo": "https://statsgh.lovable.app/images/analyst-alfredo.png",
      "analyst alfredo": "https://statsgh.lovable.app/images/analyst-alfredo.png",
    };
    
    const headlineAndBodyLower = `${articleJson.headline} ${articleSource.content} ${extractedAuthor || ""}`.toLowerCase();
    
    for (const [overrideKey, overrideImageUrl] of Object.entries(KNOWN_IMAGE_OVERRIDES)) {
      if (headlineAndBodyLower.includes(overrideKey)) {
        heroImageUrl = overrideImageUrl;
        console.log(`✓ Using known image override for "${overrideKey}": ${heroImageUrl}`);
        break;
      }
    }
    
    // FALLBACK: Generate AI image if no known person match
    if (!heroImageUrl) {
      try {
        console.log(`Generating AI image for: ${articleSlug}`);
        const imagePrompt = `${articleJson.headline}. Setting: Ghana, West Africa. Depict only generic environments, buildings, commodities, or wide establishing shots — no people's faces.`;
        heroImageUrl = await generateAiImage(imagePrompt, supabase, articleSlug);
        
        if (heroImageUrl) {
          console.log(`AI image generated: ${heroImageUrl}`);
        } else {
          console.log(`AI image generation failed for: ${articleSlug}`);
        }
      } catch (imgError) {
        console.error("Image generation error:", imgError);
      }
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
        title: custom_title ? String(custom_title).substring(0, 200) : String(articleJson.headline || "Untitled").substring(0, 200),
        slug: articleSlug,
        body: articleBody,
        summary: String(articleJson.subtitle || "").substring(0, 500),
        hero_image_url: userProvidedImage || heroImageUrl,
        category_id: categoryId,
        category_slug: categorySlug,
        author_id: user.id,
        author_name: extractedAuthor || "StatsGH Newsroom",
        section: categorySlug,
        status: isScheduled ? "scheduled" : "published",
        is_published: !isScheduled,
        published_at: isScheduled ? null : new Date().toISOString(),
        scheduled_at: isScheduled && scheduledDateTime ? scheduledDateTime.toISOString() : null,
        meta_title: custom_title ? String(custom_title).substring(0, 60) : String(articleJson.headline || "").substring(0, 60),
        seo_description: String(articleJson.seo_description || "").substring(0, 140),
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
