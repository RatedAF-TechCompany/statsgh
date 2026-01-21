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

// ============================================
// STOCK PHOTO KEYWORDS BY CATEGORY
// Uses Unsplash Source for real photography (no API key required)
// ============================================
const CATEGORY_PHOTO_KEYWORDS: Record<string, string[]> = {
  "economy-inflation": ["africa,money", "ghana,market", "africa,currency", "africa,shopping"],
  "public-finance": ["africa,government,building", "africa,parliament", "ghana,office", "africa,meeting"],
  "labour-salaries": ["africa,workers", "ghana,office", "africa,factory", "africa,employees"],
  "agriculture-food": ["ghana,farming", "africa,agriculture", "africa,market,food", "ghana,crops"],
  "energy-resources": ["africa,energy", "ghana,power", "africa,oil", "africa,solar"],
  "trade-investment": ["africa,port", "ghana,shipping", "africa,business", "africa,trade"],
  "health-data": ["africa,hospital", "ghana,healthcare", "africa,medical", "africa,clinic"],
  "education": ["africa,school", "ghana,classroom", "africa,students", "africa,university"],
  "infrastructure-transport": ["ghana,road", "africa,construction", "africa,bridge", "ghana,transport"],
  "security-governance": ["africa,government", "ghana,police", "africa,security", "africa,parliament"],
  "technology-innovation": ["africa,technology", "ghana,computer", "africa,startup", "africa,mobile"],
  "environment-climate": ["ghana,nature", "africa,environment", "africa,climate", "africa,forest"],
  "population": ["ghana,city", "africa,people", "africa,urban", "ghana,community"],
  "business": ["africa,business", "ghana,office", "africa,entrepreneur", "africa,meeting"],
  "top-stories": ["ghana,city", "africa,news", "ghana,accra", "africa,people"],
  "charts-explainers": ["africa,data", "africa,office", "africa,computer", "africa,meeting"],
  "ghanacrimes": ["africa,police", "africa,security", "africa,justice", "africa,law"],
};

const DEFAULT_PHOTO_KEYWORDS = ["ghana", "africa,business", "africa,city", "africa,people"];

function getPhotoKeywords(category: string): string {
  const keywords = CATEGORY_PHOTO_KEYWORDS[category] || DEFAULT_PHOTO_KEYWORDS;
  return keywords[Math.floor(Math.random() * keywords.length)];
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
    const { input } = body;
    
    if (!input || typeof input !== "string" || input.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Please provide article content (URL or text, minimum 20 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
Content: ${articleSource.content.substring(0, 8000)}
${articleSource.sourceUrl ? `Source URL: ${articleSource.sourceUrl}` : "Source: Manual submission"}

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
  "key_numbers": ["MINIMUM 3 items required - Array of number lines"],
  "numbers_explanation": "2-3 short paragraphs explaining what the numbers mean in real life",
  "takeaway": "One clear takeaway sentence",
  "tweet": "One sentence with at least one number, no URLs",
  "source_url": "${articleSource.sourceUrl || ""}",
  "seo_description": "SEO meta description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "A category slug like: ${PREFERRED_CATEGORIES.join(", ")} - or suggest a new one in kebab-case",
  "tags": ["array", "of", "relevant", "tags"],
  "image_prompt": "Visual description for editorial illustration, max 50 words, no text/logos/real people",
  "has_source_numbers": true or false,
  "context_added": true or false
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
      return new Response(JSON.stringify({ error: "Failed to generate article - invalid AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate numbers requirement
    const keyNumbers = Array.isArray(articleJson.key_numbers) ? articleJson.key_numbers : [];
    const validKeyNumbers = keyNumbers.filter((n: string) => {
      if (!n || typeof n !== 'string') return false;
      const lower = n.toLowerCase();
      if (lower.includes('not provided') || lower.includes('no specific') || lower.includes('not available')) return false;
      return /\d/.test(n);
    });

    if (validKeyNumbers.length < 3) {
      return new Response(JSON.stringify({ 
        error: `Editorial rejection: Only ${validKeyNumbers.length} valid numbers found (minimum 3 required for StatsGH)`,
        details: "The source content doesn't have enough numerical data and GPT couldn't add sufficient context."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Numbers validation passed: ${validKeyNumbers.length} valid numbers found`);

    // Build article body
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

    // Ensure category exists first (needed for photo keywords)
    const categorySlug = await ensureCategoryExists(supabase, articleJson.section || DEFAULT_CATEGORY);
    
    // Get stock photo from Unsplash
    const photoKeywords = getPhotoKeywords(categorySlug);
    let heroImageUrl: string | null = null;

    try {
      console.log(`Fetching stock photo for: ${articleSlug}, keywords: ${photoKeywords}`);
      
      // Unsplash Source provides real photos without API key
      const unsplashSourceUrl = `https://source.unsplash.com/1600x900/?${encodeURIComponent(photoKeywords)}`;
      
      const imageResponse = await fetch(unsplashSourceUrl, {
        redirect: "follow",
      });
      
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.arrayBuffer();
        const bytes = new Uint8Array(imageBlob);
        
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : "jpg";
        
        const imagePath = `newsroom/${articleSlug}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(imagePath, bytes, { contentType, upsert: true });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from("media")
            .getPublicUrl(imagePath);
          heroImageUrl = publicUrl.publicUrl;
          console.log(`Stock photo uploaded: ${heroImageUrl}`);
        } else {
          console.error("Image upload error:", uploadError);
        }
      } else {
        console.log(`Unsplash fetch failed: ${imageResponse.status}`);
      }
    } catch (imgError) {
      console.error("Stock photo fetch error:", imgError);
    }

    // Get category ID
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    const categoryId = categoryRow?.id || null;

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
        status: "published",
        is_published: true,
        published_at: new Date().toISOString(),
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

    console.log(`Article published: ${newArticle.id} - ${newArticle.title}`);

    return new Response(JSON.stringify({
      success: true,
      article: {
        id: newArticle.id,
        title: newArticle.title,
        slug: newArticle.slug,
        category: categorySlug,
        url: `/${categorySlug}/${newArticle.slug}`,
      },
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
