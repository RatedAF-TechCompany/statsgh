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
// IMAGE PIPELINE: Original First, AI Fallback
// ============================================

// Image rejection domains (competitor branding)
const COMPETITOR_IMAGE_DOMAINS = [
  '3news.com', 'tv3network', 'myjoyonline', 'joynews',
  'citinewsroom', 'citifm', 'gaborbreaks', 'ghanaweb',
  'graphiconline', 'graphic.com.gh', 'peacefmonline',
  'starfmonline', 'classfmonline', 'dailyguidenetwork',
  'ghanaiantimes', 'businessghana', 'pulse.com.gh',
  'modernghana', 'yen.com.gh', 'gna.org.gh', 'thebftonline',
  'bbc.co.uk', 'bbc.com', 'reuters.com', 'aljazeera',
  'africanews.com', 'bloomberg.com', 'cdngh',
  'media.myjoyonline', 'images.citinewsroom'
];

const BRANDED_IMAGE_PATTERNS = [
  'studio', 'presenter', 'anchor', 'newsroom', 'broadcast',
  'live-stream', 'livestream', 'logo', 'brand', 'watermark',
  'tv-studio', 'news-desk', 'breaking-news-graphic',
  'stock-photo', 'shutterstock', 'getty', 'istock'
];

interface ImageAttempt {
  url: string;
  source_type: string;
  success: boolean;
  rejection_reason?: string;
  timestamp: string;
}

interface ImagePipelineResult {
  final_url: string | null;
  final_source_type: 'SOURCE_HERO' | 'META_OG' | 'AI_FALLBACK' | 'KNOWN_PERSON' | 'PLACEHOLDER';
  is_ai_generated: boolean;
  image_prompt?: string;
  image_reason_fallback?: string;
  attempts: ImageAttempt[];
  image_missing: boolean;
}

// Check if URL should be rejected
function getImageRejectionReason(imageUrl: string): string | null {
  const lowerUrl = imageUrl.toLowerCase();
  
  for (const domain of COMPETITOR_IMAGE_DOMAINS) {
    if (lowerUrl.includes(domain)) {
      return `Competitor domain: ${domain}`;
    }
  }
  
  for (const pattern of BRANDED_IMAGE_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      return `Branded pattern: ${pattern}`;
    }
  }
  
  const smallPatterns = ['thumb', '100x', '50x', '32x', '16x', 'icon', 'avatar', 'sprite'];
  for (const pattern of smallPatterns) {
    if (lowerUrl.includes(pattern)) {
      return `Small image indicator: ${pattern}`;
    }
  }
  
  return null;
}

// Extract image from HTML
function extractImageFromHtml(html: string, sourceUrl: string): { url: string | null; source_type: 'SOURCE_HERO' | 'META_OG' } {
  // Priority 1: Hero/featured images
  const heroPatterns = [
    /<img[^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image|wp-post-image)[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image)[^"']*["']/i,
    /<figure[^>]*class=["'][^"']*(?:hero|featured)[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
  ];
  
  for (const pattern of heroPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const url = normalizeImageUrl(match[1], sourceUrl);
      if (url) return { url, source_type: 'SOURCE_HERO' };
    }
  }
  
  // Priority 2: OG/Twitter meta images
  const metaPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const url = normalizeImageUrl(match[1], sourceUrl);
      if (url) return { url, source_type: 'META_OG' };
    }
  }
  
  return { url: null, source_type: 'META_OG' };
}

function normalizeImageUrl(imageUrl: string, sourceUrl: string): string | null {
  try {
    if (!imageUrl || imageUrl.trim() === '') return null;
    
    let url = imageUrl.trim();
    
    if (url.startsWith('//')) url = 'https:' + url;
    
    if (url.startsWith('/')) {
      try {
        const base = new URL(sourceUrl);
        url = `${base.origin}${url}`;
      } catch { return null; }
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const isImageUrl = imageExtensions.some(ext => url.toLowerCase().includes(ext)) || 
      url.includes('/image') || url.includes('/img') || url.includes('/media');
    
    if (!isImageUrl) return null;
    
    return url;
  } catch { return null; }
}

// Fetch and upload image to storage
async function fetchAndUploadImage(
  imageUrl: string,
  supabase: any,
  articleSlug: string
): Promise<{ success: boolean; publicUrl?: string; rejection?: string }> {
  try {
    const rejection = getImageRejectionReason(imageUrl);
    if (rejection) return { success: false, rejection };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StatsGH-Newsroom/2.0 (Image Pipeline)',
        'Accept': 'image/*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return { success: false, rejection: `HTTP ${response.status}` };
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return { success: false, rejection: `Invalid content type: ${contentType}` };
    
    const imageBlob = await response.arrayBuffer();
    const bytes = new Uint8Array(imageBlob);
    
    if (bytes.length < 20000) return { success: false, rejection: `Too small: ${bytes.length} bytes` };
    
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const imagePath = `newsroom/${articleSlug}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
    
    if (uploadError) return { success: false, rejection: `Upload failed: ${uploadError.message}` };
    
    const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(imagePath);
    
    return { success: true, publicUrl: publicUrl.publicUrl };
  } catch (error) {
    return { success: false, rejection: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Generate AI image as fallback
async function generateAiImage(
  prompt: string,
  supabase: any,
  articleSlug: string
): Promise<string | null> {
  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.log('[Image] LOVABLE_API_KEY not configured');
      return null;
    }
    
    console.log(`[Image] Generating AI image for: ${articleSlug}`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{
          role: 'user',
          content: `Generate a photorealistic, professional editorial photograph for a news article. 
Style: Documentary journalism, high quality, 16:9 aspect ratio, professional lighting.
Subject: ${prompt}
Requirements: No text, no logos, no watermarks, no AI-looking faces. 
The image should look like it was taken by a professional photojournalist in Ghana or Africa.`
        }],
        modalities: ['image', 'text']
      })
    });
    
    if (!response.ok) {
      console.log(`[Image] AI generation failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData || !imageData.startsWith('data:image')) return null;
    
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) return null;
    
    const [, format, base64Data] = base64Match;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const ext = format === 'png' ? 'png' : 'jpg';
    const imagePath = `newsroom/${articleSlug}-ai.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { contentType: `image/${format === 'png' ? 'png' : 'jpeg'}`, upsert: true });
    
    if (uploadError) {
      console.error('[Image] AI upload error:', uploadError);
      return null;
    }
    
    const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(imagePath);
    console.log(`[Image] AI image generated: ${publicUrl.publicUrl}`);
    return publicUrl.publicUrl;
  } catch (error) {
    console.log(`[Image] AI error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

// Main image pipeline
async function processArticleImage(
  sourceHtml: string | null,
  sourceUrl: string | null,
  articleTitle: string,
  articleSlug: string,
  supabase: any
): Promise<ImagePipelineResult> {
  const attempts: ImageAttempt[] = [];
  const now = () => new Date().toISOString();
  
  console.log(`[Image Pipeline] Processing for: ${articleTitle.substring(0, 50)}...`);
  
  // STEP 1: Known person override (highest priority)
  const KNOWN_PERSON_IMAGES: Record<string, string> = {
    "cheddar": "https://statsgh.lovable.app/images/cheddar-nana-kwame-bediako.jpeg",
    "nana kwame bediako": "https://statsgh.lovable.app/images/cheddar-nana-kwame-bediako.jpeg",
    "alfredo": "https://statsgh.lovable.app/images/analyst-alfredo.png",
    "analyst alfredo": "https://statsgh.lovable.app/images/analyst-alfredo.png",
  };
  
  const titleLower = articleTitle.toLowerCase();
  for (const [personKey, personImageUrl] of Object.entries(KNOWN_PERSON_IMAGES)) {
    if (titleLower.includes(personKey)) {
      console.log(`[Image] Using known person image: ${personKey}`);
      return {
        final_url: personImageUrl,
        final_source_type: 'KNOWN_PERSON',
        is_ai_generated: false,
        attempts: [{ url: personImageUrl, source_type: 'KNOWN_PERSON', success: true, timestamp: now() }],
        image_missing: false
      };
    }
  }
  
  // STEP 2: Try source page image (if HTML available)
  if (sourceHtml && sourceUrl) {
    const { url: extractedUrl, source_type } = extractImageFromHtml(sourceHtml, sourceUrl);
    
    if (extractedUrl) {
      console.log(`[Image] Found ${source_type}: ${extractedUrl.substring(0, 80)}...`);
      const result = await fetchAndUploadImage(extractedUrl, supabase, articleSlug);
      
      attempts.push({
        url: extractedUrl,
        source_type,
        success: result.success,
        rejection_reason: result.rejection,
        timestamp: now()
      });
      
      if (result.success && result.publicUrl) {
        console.log(`[Image] Source image uploaded: ${result.publicUrl}`);
        return {
          final_url: result.publicUrl,
          final_source_type: source_type,
          is_ai_generated: false,
          attempts,
          image_missing: false
        };
      }
      
      console.log(`[Image] Source rejected: ${result.rejection}`);
    }
  }
  
  // STEP 3: AI-generated fallback
  console.log('[Image] Falling back to AI generation');
  const aiPrompt = `Professional editorial photograph: ${articleTitle}. African business context, Ghana, documentary style.`;
  const aiUrl = await generateAiImage(aiPrompt, supabase, articleSlug);
  
  attempts.push({
    url: 'AI_GENERATION',
    source_type: 'AI_FALLBACK',
    success: !!aiUrl,
    timestamp: now()
  });
  
  if (aiUrl) {
    return {
      final_url: aiUrl,
      final_source_type: 'AI_FALLBACK',
      is_ai_generated: true,
      image_prompt: aiPrompt,
      image_reason_fallback: sourceHtml ? 'Source image rejected' : 'No source HTML available',
      attempts,
      image_missing: false
    };
  }
  
  // STEP 4: Failsafe - placeholder
  console.log('[Image] All methods failed, article will have no image');
  return {
    final_url: null,
    final_source_type: 'PLACEHOLDER',
    is_ai_generated: false,
    image_reason_fallback: 'All image methods failed',
    attempts,
    image_missing: true
  };
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
async function fetchUrlContent(url: string): Promise<{ title: string; content: string; sourceUrl: string; html: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StatsGH-Manual-Submit/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch URL: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    let content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);
    
    return { title, content, sourceUrl: url, html };
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
    
    // Extract author attribution from input
    let extractedAuthor: string | null = null;
    const authorPatterns = [
      /\bby\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s*$/i,
      /^\s*by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s*[\n.]/i,
      /[\n.]\s*by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\s*$/i,
    ];
    
    for (const pattern of authorPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        extractedAuthor = match[1].trim();
        console.log(`Extracted author: "${extractedAuthor}"`);
        break;
      }
    }
    
    if (!input || typeof input !== "string" || input.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Please provide article content (URL or text, minimum 20 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Handle scheduling
    let scheduledDateTime: Date | null = null;
    const isAutoSchedule = scheduled_at === "auto";
    
    if (isAutoSchedule) {
      const now = new Date();
      const peakHours = [7, 9, 12, 15, 18, 20];
      const MAX_PER_DAY = 4;
      
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
      
      const findSlotOnDay = (date: Date, scheduledArticles: any[], afterHour: number = -1): Date | null => {
        if (scheduledArticles.length >= MAX_PER_DAY) return null;
        
        const takenHours = new Set(scheduledArticles.map(a => new Date(a.scheduled_at!).getHours()));
        
        for (const hour of peakHours) {
          if (hour > afterHour && !takenHours.has(hour)) {
            const slot = new Date(date);
            slot.setHours(hour, 0, 0, 0);
            return slot;
          }
        }
        return null;
      };
      
      let selectedDate: Date | null = null;
      let daysChecked = 0;
      let currentCheckDate = new Date(now);
      const currentHour = now.getHours();
      
      while (!selectedDate && daysChecked < 14) {
        const scheduledForDay = await getScheduledForDay(currentCheckDate);
        const afterHour = daysChecked === 0 ? currentHour : -1;
        const slot = findSlotOnDay(currentCheckDate, scheduledForDay, afterHour);
        
        if (slot) {
          selectedDate = slot;
        } else {
          daysChecked++;
          currentCheckDate.setDate(currentCheckDate.getDate() + 2);
          daysChecked++;
        }
      }
      
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
    }

    const inputTrimmed = input.trim();
    const isUrl = /^https?:\/\//i.test(inputTrimmed);
    
    let articleSource: { headline: string; content: string; sourceUrl: string | null; html: string | null };
    
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
        html: urlContent.html,
      };
    } else {
      const lines = inputTrimmed.split('\n').filter(l => l.trim());
      const firstLine = lines[0] || "";
      
      articleSource = {
        headline: firstLine.length < 150 ? firstLine : "",
        content: inputTrimmed,
        sourceUrl: null,
        html: null,
      };
    }

    console.log(`Processing article: "${articleSource.headline.substring(0, 50)}..."`);

    // Article generation prompt
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
      if (jsonMatch) jsonStr = jsonMatch[1];
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];
      articleJson = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to generate article - invalid AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate numbers requirement
    const keyNumbersCount = Number(articleJson.key_numbers_count) || 0;
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

    const articleBody = String(articleJson.article_body_html || "").trim();

    const slugBase = String(articleJson.slug || articleJson.headline || "article")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 80);

    const articleSlug = `${slugBase}-${Date.now()}`;

    const categorySlug = await ensureCategoryExists(supabase, articleJson.section || DEFAULT_CATEGORY);
    
    // ============================================
    // IMAGE PIPELINE: Original First, AI Fallback
    // ============================================
    const imageResult = await processArticleImage(
      articleSource.html,
      articleSource.sourceUrl,
      articleJson.headline || articleSource.headline,
      articleSlug,
      supabase
    );
    
    console.log(`[Image] Final result: ${imageResult.final_source_type}, AI: ${imageResult.is_ai_generated}`);

    // Get category ID
    const { data: categoryRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();

    const categoryId = categoryRow?.id || null;

    const isScheduled = scheduledDateTime !== null;
    
    // Insert article
    const { data: newArticle, error: insertError } = await supabase
      .from("articles")
      .insert({
        title: String(articleJson.headline || "Untitled").substring(0, 200),
        slug: articleSlug,
        body: articleBody,
        summary: String(articleJson.subtitle || "").substring(0, 500),
        hero_image_url: imageResult.final_url,
        category_id: categoryId,
        category_slug: categorySlug,
        author_id: user.id,
        author_name: extractedAuthor || "StatsGH Newsroom",
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
      image: {
        source_type: imageResult.final_source_type,
        is_ai_generated: imageResult.is_ai_generated,
        attempts: imageResult.attempts.length,
        missing: imageResult.image_missing,
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
