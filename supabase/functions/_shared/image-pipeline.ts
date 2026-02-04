/**
 * STATSGH ARTICLE IMAGE PIPELINE
 * Priority: Original First, AI Only as Fallback
 * 
 * Image sourcing priority order:
 * A) Source page hero image
 * B) Page meta image (og:image / twitter:image)
 * C) Original image search (when A/B fail or are rejected)
 * D) AI-generated fallback (only when C fails)
 */

// ============================================
// IMAGE REJECTION RULES (STRICT)
// ============================================
const COMPETITOR_IMAGE_DOMAINS = [
  '3news.com', 'tv3network', '3news',
  'myjoyonline', 'joynews', 'joyfm',
  'citinewsroom', 'citifm', 'citi97',
  'gaborbreaks', 'ghanaweb',
  'graphiconline', 'graphic.com.gh',
  'peacefmonline', 'peacefm',
  'starfmonline', 'starfm',
  'classfmonline', 'classfm',
  'dailyguidenetwork', 'dailyguide',
  'ghanaiantimes', 
  'businessghana',
  'aborotelegraph',
  'aikidigital', 'asaaseradio',
  'pulse.com.gh', 'pulse.ng',
  'modernghana',
  'yen.com.gh',
  'gna.org.gh',
  'thebftonline',
  'bbc.co.uk', 'bbc.com',
  'reuters.com', 'aljazeera',
  'africanews.com',
  'bloomberg.com',
  'cdngh', 'media.myjoyonline', 'images.citinewsroom'
];

const BRANDED_IMAGE_PATTERNS = [
  'studio', 'presenter', 'anchor', 'newsroom', 'broadcast',
  'live-stream', 'livestream', 'logo', 'brand', 'watermark',
  'tv-studio', 'news-desk', 'breaking-news-graphic',
  'stock-photo', 'shutterstock', 'getty', 'istock', 'adobe-stock',
  'placeholder', 'default-image', 'no-image'
];

const SCREENSHOT_PATTERNS = [
  'screenshot', 'screen-shot', 'capture',
  'play-button', 'video-thumb',
  'social-overlay', 'share-button',
  'caption-overlay', 'text-overlay'
];

const SENSITIVE_CONTENT_PATTERNS = [
  'gore', 'graphic-violence', 'blood',
  'minor', 'child-face', 'id-card', 'passport'
];

export type ImageSourceType = 'SOURCE_HERO' | 'META_OG' | 'ORIGINAL_SEARCH' | 'AI_FALLBACK' | 'PLACEHOLDER';

export interface ImageRejection {
  url: string;
  reason: string;
  code: 'BRANDED' | 'COMPETITOR' | 'SCREENSHOT' | 'TOO_SMALL' | 'BLURRY' | 'IRRELEVANT' | 'SENSITIVE' | 'FETCH_FAILED' | 'INVALID_FORMAT';
}

export interface ImageAttempt {
  url: string;
  source_type: ImageSourceType;
  success: boolean;
  rejection?: ImageRejection;
  timestamp: string;
}

export interface ImagePipelineResult {
  final_url: string | null;
  final_source_type: ImageSourceType;
  is_ai_generated: boolean;
  image_prompt?: string;
  image_reason_fallback?: string;
  image_source_url?: string;
  image_credit?: string;
  attempts: ImageAttempt[];
  rejections: ImageRejection[];
  image_missing: boolean;
}

// Minimum image dimensions
const MIN_IMAGE_WIDTH = 1200;
const MIN_IMAGE_SIZE_BYTES = 20000; // ~20KB minimum

/**
 * Check if an image URL should be rejected based on patterns
 */
function getImageRejection(imageUrl: string): ImageRejection | null {
  const lowerUrl = imageUrl.toLowerCase();
  
  // Check competitor domains
  for (const domain of COMPETITOR_IMAGE_DOMAINS) {
    if (lowerUrl.includes(domain)) {
      return {
        url: imageUrl,
        reason: `Competitor domain detected: ${domain}`,
        code: 'COMPETITOR'
      };
    }
  }
  
  // Check branded patterns
  for (const pattern of BRANDED_IMAGE_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      return {
        url: imageUrl,
        reason: `Branded/watermark pattern detected: ${pattern}`,
        code: 'BRANDED'
      };
    }
  }
  
  // Check screenshot patterns
  for (const pattern of SCREENSHOT_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      return {
        url: imageUrl,
        reason: `Screenshot-like pattern detected: ${pattern}`,
        code: 'SCREENSHOT'
      };
    }
  }
  
  // Check sensitive content patterns
  for (const pattern of SENSITIVE_CONTENT_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      return {
        url: imageUrl,
        reason: `Potentially sensitive content: ${pattern}`,
        code: 'SENSITIVE'
      };
    }
  }
  
  // Check for small image indicators in URL
  const smallImagePatterns = ['thumb', '100x', '50x', '32x', '16x', 'icon', 'avatar', 'sprite', 'tiny', 'small'];
  for (const pattern of smallImagePatterns) {
    if (lowerUrl.includes(pattern)) {
      return {
        url: imageUrl,
        reason: `Appears to be a small/thumbnail image: ${pattern}`,
        code: 'TOO_SMALL'
      };
    }
  }
  
  return null;
}

/**
 * Extract image URL from HTML with multiple fallback patterns
 */
function extractImageFromHtml(html: string, sourceUrl: string): { url: string | null; source_type: 'SOURCE_HERO' | 'META_OG' } {
  // Priority 1: Look for hero/featured image first
  const heroPatterns = [
    /<img[^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image|wp-post-image)[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image|wp-post-image)[^"']*["']/i,
    /<figure[^>]*class=["'][^"']*(?:hero|featured|main)[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
    /<div[^>]+class=["'][^"']*(?:hero-image|featured-image|article-hero)[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
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
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
  ];
  
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const url = normalizeImageUrl(match[1], sourceUrl);
      if (url) return { url, source_type: 'META_OG' };
    }
  }
  
  // Priority 3: JSON-LD structured data
  const jsonLdPatterns = [
    /"image"\s*:\s*"([^"]+)"/i,
    /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
    /"primaryImageOfPage"[\s\S]*?"url"\s*:\s*"([^"]+)"/i,
  ];
  
  for (const pattern of jsonLdPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const url = normalizeImageUrl(match[1], sourceUrl);
      if (url) return { url, source_type: 'META_OG' };
    }
  }
  
  return { url: null, source_type: 'META_OG' };
}

/**
 * Normalize image URL (handle relative paths, protocol-relative URLs)
 */
function normalizeImageUrl(imageUrl: string, sourceUrl: string): string | null {
  try {
    if (!imageUrl || imageUrl.trim() === '') return null;
    
    let url = imageUrl.trim();
    
    // Protocol-relative URL
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    
    // Relative URL
    if (url.startsWith('/')) {
      try {
        const base = new URL(sourceUrl);
        url = `${base.origin}${url}`;
      } catch {
        return null;
      }
    }
    
    // Must be a valid URL now
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }
    
    // Check if it looks like an image URL
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    const isImageUrl = imageExtensions.some(ext => url.toLowerCase().includes(ext)) || 
      url.includes('/image') || 
      url.includes('/img') ||
      url.includes('/photo') ||
      url.includes('/media');
    
    if (!isImageUrl) return null;
    
    return url;
  } catch {
    return null;
  }
}

/**
 * Fetch and validate an image
 */
async function fetchAndValidateImage(
  imageUrl: string,
  supabase: any,
  articleSlug: string,
  sourceType: ImageSourceType
): Promise<{ 
  success: boolean; 
  publicUrl?: string; 
  rejection?: ImageRejection;
}> {
  try {
    console.log(`[Image Pipeline] Fetching image: ${imageUrl}`);
    
    // Check URL patterns first
    const urlRejection = getImageRejection(imageUrl);
    if (urlRejection) {
      console.log(`[Image Pipeline] Rejected by URL pattern: ${urlRejection.reason}`);
      return { success: false, rejection: urlRejection };
    }
    
    // Fetch the image
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
    
    if (!response.ok) {
      return {
        success: false,
        rejection: {
          url: imageUrl,
          reason: `HTTP ${response.status} response`,
          code: 'FETCH_FAILED'
        }
      };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return {
        success: false,
        rejection: {
          url: imageUrl,
          reason: `Invalid content type: ${contentType}`,
          code: 'INVALID_FORMAT'
        }
      };
    }
    
    const imageBlob = await response.arrayBuffer();
    const bytes = new Uint8Array(imageBlob);
    
    // Check image size
    if (bytes.length < MIN_IMAGE_SIZE_BYTES) {
      return {
        success: false,
        rejection: {
          url: imageUrl,
          reason: `Image too small: ${bytes.length} bytes (min ${MIN_IMAGE_SIZE_BYTES})`,
          code: 'TOO_SMALL'
        }
      };
    }
    
    // Determine file extension
    const ext = contentType.includes('png') ? 'png' : 
                contentType.includes('webp') ? 'webp' : 'jpg';
    
    // Upload to storage
    const suffix = sourceType === 'AI_FALLBACK' ? '-ai' : '';
    const imagePath = `newsroom/${articleSlug}${suffix}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { 
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, 
        upsert: true 
      });
    
    if (uploadError) {
      console.error('[Image Pipeline] Upload error:', uploadError);
      return {
        success: false,
        rejection: {
          url: imageUrl,
          reason: `Upload failed: ${uploadError.message}`,
          code: 'FETCH_FAILED'
        }
      };
    }
    
    const { data: publicUrl } = supabase.storage
      .from('media')
      .getPublicUrl(imagePath);
    
    console.log(`[Image Pipeline] Successfully uploaded: ${publicUrl.publicUrl}`);
    return { success: true, publicUrl: publicUrl.publicUrl };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[Image Pipeline] Fetch error: ${message}`);
    return {
      success: false,
      rejection: {
        url: imageUrl,
        reason: `Fetch error: ${message}`,
        code: 'FETCH_FAILED'
      }
    };
  }
}

/**
 * Generate AI image as fallback
 */
async function generateAiFallbackImage(
  prompt: string,
  supabase: any,
  articleSlug: string,
  fallbackReason: string
): Promise<{ success: boolean; publicUrl?: string; prompt: string }> {
  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.log('[Image Pipeline] LOVABLE_API_KEY not configured, skipping AI image');
      return { success: false, prompt };
    }
    
    console.log(`[Image Pipeline] Generating AI image for: ${articleSlug}`);
    console.log(`[Image Pipeline] Fallback reason: ${fallbackReason}`);
    
    const fullPrompt = `Generate a photorealistic, professional editorial photograph for a news article. 
Style: Documentary journalism, high quality, 16:9 aspect ratio, professional lighting.
Subject: ${prompt}
Requirements: 
- No text, no logos, no watermarks
- No faces that look AI-generated
- The image should look like it was taken by a professional photojournalist in Ghana or Africa
- Clean, editorial style suitable for a news website
- High resolution, sharp focus`;
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: fullPrompt }],
        modalities: ['image', 'text']
      })
    });
    
    if (!response.ok) {
      console.log(`[Image Pipeline] AI generation failed: ${response.status}`);
      return { success: false, prompt: fullPrompt };
    }
    
    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData || !imageData.startsWith('data:image')) {
      console.log('[Image Pipeline] No valid image in AI response');
      return { success: false, prompt: fullPrompt };
    }
    
    // Parse base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.log('[Image Pipeline] Could not parse AI image data');
      return { success: false, prompt: fullPrompt };
    }
    
    const [, format, base64Data] = base64Match;
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const ext = format === 'png' ? 'png' : 'jpg';
    const contentType = `image/${format === 'png' ? 'png' : 'jpeg'}`;
    const imagePath = `newsroom/${articleSlug}-ai.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { contentType, upsert: true });
    
    if (uploadError) {
      console.error('[Image Pipeline] AI image upload error:', uploadError);
      return { success: false, prompt: fullPrompt };
    }
    
    const { data: publicUrl } = supabase.storage
      .from('media')
      .getPublicUrl(imagePath);
    
    console.log(`[Image Pipeline] AI image generated: ${publicUrl.publicUrl}`);
    return { success: true, publicUrl: publicUrl.publicUrl, prompt: fullPrompt };
    
  } catch (error) {
    console.log(`[Image Pipeline] AI image error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return { success: false, prompt };
  }
}

/**
 * Get neutral placeholder image URL
 */
function getPlaceholderImage(category: string): string {
  // Return a neutral placeholder - could be expanded with category-specific placeholders
  return 'https://ofhejtwaigiqyejbvncz.supabase.co/storage/v1/object/public/media/placeholders/article-placeholder.jpg';
}

/**
 * Main image pipeline function
 * Implements the full priority order with fallbacks
 */
export async function processArticleImage(
  sourceHtml: string,
  sourceUrl: string,
  articleTitle: string,
  articleSlug: string,
  category: string,
  supabase: any
): Promise<ImagePipelineResult> {
  const attempts: ImageAttempt[] = [];
  const rejections: ImageRejection[] = [];
  const now = () => new Date().toISOString();
  
  console.log(`[Image Pipeline] Processing image for: ${articleTitle.substring(0, 50)}...`);
  
  // STEP A & B: Extract image from source HTML
  const { url: extractedUrl, source_type: extractedType } = extractImageFromHtml(sourceHtml, sourceUrl);
  
  if (extractedUrl) {
    console.log(`[Image Pipeline] Found ${extractedType} image: ${extractedUrl}`);
    
    const result = await fetchAndValidateImage(extractedUrl, supabase, articleSlug, extractedType);
    
    attempts.push({
      url: extractedUrl,
      source_type: extractedType,
      success: result.success,
      rejection: result.rejection,
      timestamp: now()
    });
    
    if (result.success && result.publicUrl) {
      return {
        final_url: result.publicUrl,
        final_source_type: extractedType,
        is_ai_generated: false,
        image_source_url: extractedUrl,
        attempts,
        rejections,
        image_missing: false
      };
    }
    
    if (result.rejection) {
      rejections.push(result.rejection);
    }
  } else {
    console.log('[Image Pipeline] No image found in source HTML');
  }
  
  // STEP C: Original image search is not implemented in this version
  // Would require integration with reverse image search APIs
  // For now, we skip directly to AI fallback
  const fallbackReason = extractedUrl 
    ? `Source image rejected: ${rejections[rejections.length - 1]?.reason || 'Unknown reason'}`
    : 'No usable image found in source page';
  
  // STEP D: AI-generated fallback
  console.log('[Image Pipeline] Falling back to AI image generation');
  
  const aiPrompt = `Professional editorial photograph: ${articleTitle}. African business context, Ghana, documentary style.`;
  const aiResult = await generateAiFallbackImage(aiPrompt, supabase, articleSlug, fallbackReason);
  
  attempts.push({
    url: 'AI_GENERATION',
    source_type: 'AI_FALLBACK',
    success: aiResult.success,
    timestamp: now()
  });
  
  if (aiResult.success && aiResult.publicUrl) {
    return {
      final_url: aiResult.publicUrl,
      final_source_type: 'AI_FALLBACK',
      is_ai_generated: true,
      image_prompt: aiResult.prompt,
      image_reason_fallback: fallbackReason,
      attempts,
      rejections,
      image_missing: false
    };
  }
  
  // FAILSAFE: Return placeholder
  console.log('[Image Pipeline] All methods failed, using placeholder');
  
  return {
    final_url: getPlaceholderImage(category),
    final_source_type: 'PLACEHOLDER',
    is_ai_generated: false,
    image_reason_fallback: `${fallbackReason}; AI generation also failed`,
    attempts,
    rejections,
    image_missing: true
  };
}

/**
 * Log image pipeline results to audit
 */
export function formatImageAuditLog(result: ImagePipelineResult): Record<string, any> {
  return {
    image_final_url: result.final_url,
    image_final_source_type: result.final_source_type,
    image_is_ai_generated: result.is_ai_generated,
    image_attempts: result.attempts,
    image_rejections: result.rejections,
    image_missing: result.image_missing,
    image_prompt: result.image_prompt,
    image_reason_fallback: result.image_reason_fallback,
    image_source_url: result.image_source_url,
    image_credit: result.image_credit
  };
}
