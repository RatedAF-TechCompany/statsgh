import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

type ImageSourceType = 'SOURCE_HERO' | 'META_OG' | 'AI_FALLBACK' | 'KNOWN_PERSON' | 'PLACEHOLDER' | 'NONE';

interface ImageAttempt {
  url: string;
  source_type: string;
  success: boolean;
  rejection_reason?: string;
  timestamp: string;
}

interface ImagePipelineResult {
  final_url: string | null;
  final_source_type: ImageSourceType;
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

// Fetch page content
async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StatsGH-Backfill/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
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
        'User-Agent': 'StatsGH-Backfill/2.0 (Image Pipeline)',
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
    const imagePath = `newsroom/${articleSlug}-backfill.${ext}`;
    
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

// Main image pipeline for backfill
async function processArticleImageForBackfill(
  article: { id: string; title: string; slug: string; section: string; category_slug: string },
  supabase: any
): Promise<ImagePipelineResult> {
  const attempts: ImageAttempt[] = [];
  const now = () => new Date().toISOString();
  
  console.log(`[Backfill] Processing: ${article.title.substring(0, 50)}...`);
  
  // Check if we have a source URL in newsroom_articles
  const { data: newsroomArticle } = await supabase
    .from("newsroom_articles")
    .select("source_url")
    .eq("generated_article_id", article.id)
    .maybeSingle();
  
  const sourceUrl = newsroomArticle?.source_url;
  
  // STEP 1: Try to fetch source page and extract image
  if (sourceUrl) {
    console.log(`[Backfill] Fetching source: ${sourceUrl}`);
    const sourceHtml = await fetchPageHtml(sourceUrl);
    
    if (sourceHtml) {
      const { url: extractedUrl, source_type } = extractImageFromHtml(sourceHtml, sourceUrl);
      
      if (extractedUrl) {
        console.log(`[Backfill] Found ${source_type}: ${extractedUrl.substring(0, 80)}...`);
        const result = await fetchAndUploadImage(extractedUrl, supabase, article.slug);
        
        attempts.push({
          url: extractedUrl,
          source_type,
          success: result.success,
          rejection_reason: result.rejection,
          timestamp: now()
        });
        
        if (result.success && result.publicUrl) {
          console.log(`[Backfill] Source image uploaded: ${result.publicUrl}`);
          return {
            final_url: result.publicUrl,
            final_source_type: source_type,
            is_ai_generated: false,
            attempts,
            image_missing: false
          };
        }
        
        console.log(`[Backfill] Source rejected: ${result.rejection}`);
      }
    }
  }
  
  // STEP 2: AI-generated fallback
  console.log('[Backfill] Falling back to AI generation');
  const aiPrompt = `Professional editorial photograph: ${article.title}. African business context, Ghana, documentary style.`;
  const aiUrl = await generateAiImage(aiPrompt, supabase, article.slug);
  
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
      image_reason_fallback: sourceUrl ? 'Source image rejected or unavailable' : 'No source URL available',
      attempts,
      image_missing: false
    };
  }
  
  // STEP 3: Failsafe
  console.log('[Backfill] All methods failed');
  return {
    final_url: null,
    final_source_type: 'NONE',
    is_ai_generated: false,
    image_reason_fallback: 'All image methods failed',
    attempts,
    image_missing: true
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 10);

    // Find articles without images
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, slug, section, category_slug")
      .is("hero_image_url", null)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    console.log(`Found ${articles?.length || 0} articles without images`);

    let updated = 0;
    const results: Array<{
      id: string;
      title: string;
      image_url: string | null;
      source_type: ImageSourceType;
      is_ai_generated: boolean;
      attempts: number;
    }> = [];

    for (const article of articles || []) {
      console.log(`Processing: ${article.title}`);
      
      const imageResult = await processArticleImageForBackfill(article, supabase);

      // Update article with image
      if (imageResult.final_url) {
        const { error: updateError } = await supabase
          .from("articles")
          .update({ hero_image_url: imageResult.final_url })
          .eq("id", article.id);

        if (!updateError) {
          updated++;
          console.log(`✓ Updated article: ${article.title}`);
        } else {
          console.error(`Update error for ${article.id}:`, updateError);
        }
      }

      results.push({
        id: article.id,
        title: article.title,
        image_url: imageResult.final_url,
        source_type: imageResult.final_source_type,
        is_ai_generated: imageResult.is_ai_generated,
        attempts: imageResult.attempts.length,
      });

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        articles_processed: articles?.length || 0,
        articles_updated: updated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
