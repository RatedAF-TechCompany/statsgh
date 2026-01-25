import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Remove accidental duplicated words/phrases like "not not" or "not. not".
// Collapses immediate repeated tokens (case-insensitive). Keeps numbers intact.
function collapseImmediateWordRepeats(input: string): string {
  if (!input) return input;
  let s = String(input);
  s = s.replace(/\s+/g, " ").trim();

  // Apply twice to handle triple repeats.
  for (let i = 0; i < 2; i++) {
    s = s.replace(/\b([a-zA-Z]+)\b([\s.,;:!?]+\1\b)+/gi, "$1");
    s = s.replace(/\s+/g, " ").trim();
  }
  return s;
}

// ============================================
// STATSGH NEWSROOM MASTER CONFIGURATION
// ============================================
const TIME_WINDOW_HOURS = 24; // Scan last 24 hours but skip already published articles
const DEFAULT_MAX_ARTICLES_PER_RUN = 5; // Limit per run to avoid edge function timeout

// "Fast publish" outlets: publish items from these sources even if they don't satisfy
// the normal newsroom filtering rules (business/crime/gossip/numbers).
// We still keep: time window + dedupe + source attribution + no fabrication.
const FAST_PUBLISH_DOMAINS = new Set<string>([
  "graphic.com.gh",
  "ceditalk.com",
  "myjoyonline.com",
  "3news.com",
  "starrfm.com.gh",
  "ghanaweb.com",
  "citibusinessnews.com",
  "gna.org.gh",
  // Kumasi/Regional sources
  "kumasimail.com",
  "kessbenonline.com",
  "sompaonline.com",
  "ghstandard.com",
  "yen.com.gh",
]);

// Ghana business news sources with RSS feeds
const RSS_SOURCES = [
  // National sources
  { name: "Graphic Online Business", rss: "https://www.graphic.com.gh/business/business-news.html?format=feed&type=rss", domain: "graphic.com.gh" },
  { name: "CediTalk", rss: "https://www.ceditalk.com/feed/", domain: "ceditalk.com" },
  { name: "JoyBusiness", rss: "https://www.myjoyonline.com/business/feed/", domain: "myjoyonline.com" },
  { name: "MyJoyOnline News", rss: "https://www.myjoyonline.com/feed/", domain: "myjoyonline.com" },
  { name: "3News Ghana", rss: "https://3news.com/feed/", domain: "3news.com" },
  { name: "Starr FM Business", rss: "https://starrfm.com.gh/category/business/feed/", domain: "starrfm.com.gh" },
  { name: "Citi Business News", rss: "https://citibusinessnews.com/feed/", domain: "citibusinessnews.com" },
  { name: "Ghana News Agency Business", rss: "https://gna.org.gh/category/business/feed/", domain: "gna.org.gh" },
  // Kumasi/Regional sources
  { name: "Kumasi Mail", rss: "https://kumasimail.com/feed/", domain: "kumasimail.com" },
  { name: "Kessben Online", rss: "https://kessbenonline.com/feed/", domain: "kessbenonline.com" },
  { name: "Sompa Online", rss: "https://sompaonline.com/feed/", domain: "sompaonline.com" },
  { name: "Ghana Standard Kumasi", rss: "https://ghstandard.com/news/kumasi/feed/", domain: "ghstandard.com" },
  { name: "YEN Ghana", rss: "https://yen.com.gh/feed/", domain: "yen.com.gh" },
] as const;

// HTML scrape sources (no RSS available)
const SCRAPE_SOURCES = [
  { 
    name: "GhanaWeb Business", 
    url: "https://www.ghanaweb.com/GhanaHomePage/business/", 
    domain: "ghanaweb.com",
    articlePattern: /href="((?:https?:\/\/(?:www\.)?ghanaweb\.com)?\/GhanaHomePage\/(?:business|NewsArchive)\/artikel\.php\?ID=\d+)"/gi,
    titlePattern: /<a[^>]+href="[^"]*artikel\.php\?ID=\d+"[^>]*>([^<]+)<\/a>/gi,
    type: "news" as const,
  },
  { 
    name: "GhanaWeb Opinions", 
    url: "https://www.ghanaweb.com/GhanaHomePage/opinions/", 
    domain: "ghanaweb.com",
    // GhanaWeb opinions now use /features/[slug]-[ID] format
    articlePattern: /href="((?:https?:\/\/(?:www\.)?ghanaweb\.com)?\/GhanaHomePage\/features\/[^"]+\-\d+)"/gi,
    titlePattern: /<a[^>]+href="[^"]*\/features\/[^"]+\-\d+"[^>]*>([^<]+)<\/a>/gi,
    type: "opinion" as const,
  },
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
  "opinion",
  "charts-explainers",
] as const;

// Crime-related keywords to EXCLUDE (unless statistical analysis)
const CRIME_EXCLUSION_KEYWORDS = [
  "murder", "murdered", "killing", "killed", "stabbed", "stabbing",
  "robbed", "robbery", "armed robbery", "thieves", "thief", "stealing",
  "rape", "raped", "rapist", "sexual assault", "defilement",
  "kidnap", "kidnapped", "kidnapping", "abducted", "abduction",
  "fraud", "scam", "scammer", "419", "sakawa",
  "arrested", "arrest", "custody", "remanded", "jailed", "prison sentence",
  "court sentences", "sentenced to", "years imprisonment",
  "assault", "assaulted", "attacked", "beaten", "beating",
  "shot dead", "gunned down", "shooting", "gunshots",
  "manslaughter", "homicide", "crime scene", "criminal",
  "suspect", "accused", "culprit", "perpetrator",
  "police arrest", "nabbed", "apprehended",
  "ritual", "ritualist", "blood money", "human sacrifice",
  "lynch", "lynched", "mob justice", "vigilante",
  "domestic violence", "abuse", "child abuse",
] as const;

// Political drama/gossip keywords to EXCLUDE (lacks data substance)
const POLITICAL_GOSSIP_EXCLUSION_KEYWORDS = [
  // Political drama without data
  "warns", "slams", "blasts", "fires back", "claps back", "hits back",
  "attacks", "accuses", "alleges", "feud", "clash", "rift",
  "calls out", "calls for resignation", "must resign", "should resign",
  "responds to", "reacts to", "defends", "denies", "dismisses",
  "controversy", "controversial", "scandalous", "outrage", "outraged",
  "absence", "absent", "missing", "whereabouts", "disappeared",
  // Political speculation
  "rumour", "rumor", "rumoured", "rumored", "speculation", "speculates",
  "allegedly", "purported", "unconfirmed", "sources say", "insiders say",
  // Celebrity/personality focus
  "spotted", "seen with", "relationship", "dating", "affair",
  "personal life", "private life", "family drama",
  // Emotional/opinion pieces
  "angry", "furious", "livid", "upset", "emotional", "heartbroken",
  "betrayed", "disappointed", "hurt feelings",
] as const;

// Statistical/analytical keywords that override crime exclusion
const CRIME_STATS_OVERRIDE_KEYWORDS = [
  // Direct statistical terms
  "crime statistics", "crime rate", "crime data", "crime report",
  "annual crime", "crime trends", "crime reduction", "crime increased",
  "police statistics", "criminal justice reform", "crime prevention",
  "security statistics", "law enforcement data",
  // Analytical context indicators
  "according to", "unicef", "world bank", "survey", "study", "research",
  "percent of", "% of", "percentage", "statistics show", "data shows",
  "report shows", "report indicates", "analysis", "trend",
  // Policy/reform context
  "child protection", "protection laws", "policy reform", "law reform",
  "legislative", "parliament", "regulation", "legal reform",
] as const;

// Data-driven indicators that make content acceptable for StatsGH
const DATA_SUBSTANCE_KEYWORDS = [
  // Financial data
  "ghs", "ghc", "usd", "million", "billion", "trillion", "budget",
  "revenue", "expenditure", "deficit", "surplus", "gdp", "gnp",
  // Statistical terms
  "percent", "%", "rate", "index", "ratio", "average", "median",
  "growth", "decline", "increase", "decrease", "rose", "fell",
  "statistics", "data", "figures", "numbers", "metrics",
  // Economic indicators
  "inflation", "interest rate", "exchange rate", "unemployment",
  "trade balance", "import", "export", "investment", "fdi",
  // Quantitative context
  "target", "projection", "forecast", "estimate", "quarter", "annual",
  "year-on-year", "month-on-month", "per capita", "per annum",
] as const;

// Default category if GPT returns an invalid slug format
const DEFAULT_CATEGORY = "business";

// Rejection codes for audit trail
const REJECTION_CODES = {
  OUTSIDE_TIME_WINDOW: "OUTSIDE_TIME_WINDOW",
  PUBDATE_PARSE_FAILED: "PUBDATE_PARSE_FAILED",
  NOT_BUSINESS: "NOT_BUSINESS",
  NOT_GHANA_RELEVANT: "NOT_GHANA_RELEVANT",
  CRIME_FILTER: "CRIME_FILTER",
  POLITICAL_GOSSIP: "POLITICAL_GOSSIP",
  NO_NUMBERS_IN_RSS: "NO_NUMBERS_IN_RSS",
  NO_NUMBERS_IN_FULL_PAGE: "NO_NUMBERS_IN_FULL_PAGE",
  DEDUPED_NEWSROOM: "DEDUPED_NEWSROOM",
  DEDUPED_ARTICLES: "DEDUPED_ARTICLES",
  AI_JSON_INVALID: "AI_JSON_INVALID",
  AI_REJECTED_NO_NUMBERS: "AI_REJECTED_NO_NUMBERS",
  HEADLINE_NO_NUMBER: "HEADLINE_NO_NUMBER",
  INSUFFICIENT_NUMBERS: "INSUFFICIENT_NUMBERS",
  IMAGE_FETCH_FAILED: "IMAGE_FETCH_FAILED",
  RSS_FETCH_FAILED: "RSS_FETCH_FAILED",
  FULL_PAGE_FETCH_FAILED: "FULL_PAGE_FETCH_FAILED",
} as const;

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
  "opinion": ["africa,writing", "ghana,newspaper", "africa,discussion", "africa,debate"],
  "charts-explainers": ["africa,data", "africa,office", "africa,computer", "africa,meeting"],
};

const DEFAULT_PHOTO_KEYWORDS = ["ghana", "africa,business", "africa,city", "africa,people"];

function getPhotoKeywords(category: string): string {
  const keywords = CATEGORY_PHOTO_KEYWORDS[category] || DEFAULT_PHOTO_KEYWORDS;
  return keywords[Math.floor(Math.random() * keywords.length)];
}

// ============================================
// IMAGE EXTRACTION FROM SOURCE ARTICLE
// Priority: 1) Source image, 2) Unsplash, 3) AI-generated
// ============================================
// Known competitor/news outlet domains whose images should be skipped
// These images often contain branding, logos, studio shots with visible branding
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
  // Common CDN patterns for news images
  'cdngh', 'media.myjoyonline', 'images.citinewsroom'
];

// Patterns in image URLs that indicate branded/studio content
const BRANDED_IMAGE_PATTERNS = [
  'studio', 'presenter', 'anchor', 'newsroom', 'broadcast',
  'live-stream', 'livestream', 'logo', 'brand', 'watermark',
  'tv-studio', 'news-desk', 'breaking-news-graphic'
];

function isCompetitorImage(imageUrl: string): boolean {
  const lowerUrl = imageUrl.toLowerCase();
  
  // Check if image is from a competitor domain
  if (COMPETITOR_IMAGE_DOMAINS.some(domain => lowerUrl.includes(domain))) {
    console.log(`⚠ Skipping competitor image from: ${imageUrl.substring(0, 100)}...`);
    return true;
  }
  
  // Check for branded image patterns
  if (BRANDED_IMAGE_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
    console.log(`⚠ Skipping branded image pattern in: ${imageUrl.substring(0, 100)}...`);
    return true;
  }
  
  return false;
}

async function extractImageFromSourceHtml(html: string, sourceUrl: string): Promise<string | null> {
  try {
    // Common patterns for article hero/featured images
    const patterns = [
      // Open Graph image (most reliable for featured images)
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      // Twitter card image
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      // Schema.org image
      /"image"\s*:\s*"([^"]+)"/i,
      /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
      // Article featured image patterns
      /<img[^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image)[^"']*["'][^>]+src=["']([^"']+)["']/i,
      /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image)[^"']*["']/i,
      // First large image in article (data-src for lazy loading)
      /<img[^>]+data-src=["']([^"']+)["'][^>]+width=["']([4-9]\d{2}|[1-9]\d{3})["']/i,
      // Figure with img inside (common article pattern)
      /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
    ];
    
    let imageUrl: string | null = null;
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        // Get the first capture group that looks like a URL
        const url = match[1] || match[2];
        if (url && (url.startsWith('http') || url.startsWith('//'))) {
          imageUrl = url;
          break;
        }
      }
    }
    
    if (!imageUrl) return null;
    
    // Handle protocol-relative URLs
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }
    
    // Handle relative URLs
    if (imageUrl.startsWith('/')) {
      try {
        const urlObj = new URL(sourceUrl);
        imageUrl = `${urlObj.origin}${imageUrl}`;
      } catch {
        return null;
      }
    }
    
    // *** CHECK FOR COMPETITOR BRANDING ***
    if (isCompetitorImage(imageUrl)) {
      return null; // Skip competitor images, fall back to AI generation
    }
    
    // Validate it's actually an image URL
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const isImageUrl = imageExtensions.some(ext => 
      imageUrl!.toLowerCase().includes(ext)
    ) || imageUrl.includes('/image') || imageUrl.includes('img');
    
    if (!isImageUrl) return null;
    
    // Skip small images (likely icons/logos) based on URL patterns
    const skipPatterns = ['logo', 'icon', 'avatar', 'sprite', 'thumb', '100x', '50x', '32x', '16x'];
    if (skipPatterns.some(p => imageUrl!.toLowerCase().includes(p))) {
      return null;
    }
    
    console.log(`Found source image: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.log(`Image extraction error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

// Fetch and upload an image from URL to Supabase storage
async function fetchAndUploadImage(
  imageUrl: string, 
  supabase: any, 
  articleSlug: string
): Promise<string | null> {
  try {
    console.log(`Fetching image from: ${imageUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StatsGH-Newsroom/1.0 (Image Fetcher)',
        'Accept': 'image/*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`Image fetch failed: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.log(`Not an image: ${contentType}`);
      return null;
    }
    
    const imageBlob = await response.arrayBuffer();
    const bytes = new Uint8Array(imageBlob);
    
    // Check minimum size (at least 10KB to filter out placeholders)
    if (bytes.length < 10000) {
      console.log(`Image too small (${bytes.length} bytes), skipping`);
      return null;
    }
    
    const ext = contentType.includes('png') ? 'png' : 
                contentType.includes('webp') ? 'webp' : 'jpg';
    
    const imagePath = `newsroom/${articleSlug}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(imagePath, bytes, { contentType, upsert: true });
    
    if (uploadError) {
      console.error('Image upload error:', uploadError);
      return null;
    }
    
    const { data: publicUrl } = supabase.storage
      .from('media')
      .getPublicUrl(imagePath);
    
    console.log(`Source image uploaded: ${publicUrl.publicUrl}`);
    return publicUrl.publicUrl;
  } catch (error) {
    console.log(`Image fetch/upload error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

// Generate AI image as last resort using Lovable AI (Gemini)
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
    
    // Use Gemini image generation through Lovable AI gateway
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
Requirements: No text, no logos, no watermarks, no faces that look AI-generated. 
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
    const imagePath = `newsroom/${articleSlug}-ai.${ext}`;
    
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

// Check if text is crime news (should be excluded unless statistical)
function isCrimeNews(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // First check if it's statistical crime analysis (allowed)
  const isStatisticalAnalysis = CRIME_STATS_OVERRIDE_KEYWORDS.some(keyword => 
    lowerText.includes(keyword)
  );
  if (isStatisticalAnalysis) {
    return false; // Not excluded - it's statistical content
  }
  
  // Also allow if text contains percentage patterns with context (e.g., "90% of children")
  const hasPercentageWithContext = /\d+%\s+of\s+\w+/i.test(text) || /\d+\s+percent\s+of/i.test(text);
  if (hasPercentageWithContext) {
    return false; // Statistical percentage pattern detected
  }
  
  // Check for crime keywords (excluded)
  return CRIME_EXCLUSION_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

// Check if text is political gossip/drama without data substance
function isPoliticalGossip(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // First check if it has data substance (allowed even if it looks like gossip)
  const hasDataSubstance = DATA_SUBSTANCE_KEYWORDS.some(keyword => 
    lowerText.includes(keyword)
  );
  
  // Also check for actual numbers with context
  const hasSignificantNumbers = /\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*(?:million|billion|percent|%|ghs|usd|ghc))/i.test(text);
  
  if (hasDataSubstance || hasSignificantNumbers) {
    return false; // Has data substance, not excluded
  }
  
  // Check for political gossip keywords (excluded if no data)
  return POLITICAL_GOSSIP_EXCLUSION_KEYWORDS.some(keyword => 
    lowerText.includes(keyword)
  );
}

// ============================================
// GHANA RELEVANCE CHECK - APPLIES TO ALL SOURCES
// This ensures we don't publish international news that has nothing to do with Ghana
// ============================================
const GHANA_RELEVANCE_KEYWORDS = [
  // Country/Region
  "ghana", "ghanaian", "accra", "kumasi", "tamale", "takoradi", "tema", "cape coast",
  "ashanti", "volta", "eastern region", "western region", "northern region", "greater accra",
  "brong ahafo", "upper east", "upper west", "central region", "oti region", "savannah",
  "bono east", "ahafo", "north east", "western north",
  // Institutions
  "bog", "bank of ghana", "gse", "ghana stock exchange", "gra", "ghana revenue",
  "cocobod", "gnpc", "vra", "ecg", "gpha", "ghacem", "goil", "tullow ghana",
  "mtn ghana", "vodafone ghana", "airtel-tigo", "airteltigo", "stanbic ghana",
  "gcb", "ecobank ghana", "fidelity bank", "calbank", "unibank", "databank",
  // Currency
  "cedi", "cedis", "ghc", "ghs",
  // Government
  "parliament of ghana", "ndc", "npp", "akufo-addo", "bawumia", "mahama",
  "finance minister", "ministry of finance", "ofori-atta", "ken ofori",
  // Sports/Entertainment (if relevant)
  "black stars", "kotoko", "hearts of oak",
] as const;

// Check if content is relevant to Ghana
function isGhanaRelevant(text: string): boolean {
  const lowerText = text.toLowerCase();
  return GHANA_RELEVANCE_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

// Check if text contains numbers (required for StatsGH)
function containsNumbers(text: string): boolean {
  return /\d+/.test(text);
}

// Extract numbers found in text for audit trail
function extractNumbers(text: string): string[] {
  const matches = text.match(/\d[\d,\.]*(?:\s*(?:%|percent|million|billion|ghs|usd|ghc))?/gi);
  return matches ? [...new Set(matches.slice(0, 10))] : [];
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

// Fetch full article page and extract text content
async function fetchFullPageText(url: string, timeout = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StatsGH-Newsroom/1.0 (Content Reader)',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Special handling for GhanaWeb: extract article body from specific div
    const isGhanaWeb = url.includes('ghanaweb.com');
    let text = '';
    
    if (isGhanaWeb) {
      // GhanaWeb uses specific article content containers
      // Try to extract from article-content or feature-body divs
      const articleContentMatch = html.match(/<div[^>]+class="[^"]*(?:article-content|feature-body|entry-content|post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      
      if (articleContentMatch) {
        text = articleContentMatch[1];
      } else {
        // Fallback: Extract content between common article markers
        const mainMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (mainMatch) {
          text = mainMatch[1];
        } else {
          // Last resort: try to find the main text block after stripping junk
          text = html;
        }
      }
    } else {
      text = html;
    }
    
    // Extract text from HTML - remove scripts, styles, then strip tags
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ') // Remove login forms
      .replace(/<div[^>]*class="[^"]*(?:login|signup|subscribe|newsletter|terms|cookie|consent|modal|popup|overlay|sidebar|advertisement|ad-|banner)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      // Remove common boilerplate text patterns
      .replace(/Terms of Service[\s\S]{0,200}Privacy Policy/gi, ' ')
      .replace(/Log\s*in[\s\S]{0,100}Sign\s*up/gi, ' ')
      .replace(/Cookie[\s\S]{0,100}preferences/gi, ' ')
      .replace(/Subscribe to our newsletter/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit to first 5000 chars for efficiency
    return text.substring(0, 5000);
  } catch (error) {
    console.log(`Full page fetch error for ${url}:`, error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

// ============================================
// GHANAWEB HTML SCRAPER
// Fetches the business page and extracts article links/headlines
// ============================================
interface ScrapedArticle {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source_name: string;
  is_opinion?: boolean;
}

async function scrapeGhanaWebBusiness(timeout = 15000): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch("https://www.ghanaweb.com/GhanaHomePage/business/", {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`GhanaWeb scrape failed: ${response.status}`);
      return articles;
    }
    
    const html = await response.text();
    console.log(`GhanaWeb HTML fetched: ${html.length} chars`);
    
    // Extract article links and titles from the business page
    // GhanaWeb now uses semantic URLs like: /GhanaHomePage/business/ARTICLE-TITLE-SLUG-123456
    
    // Find all article links with their titles
    const articleMatches: Array<{ url: string; title: string }> = [];
    
    // Pattern 1: Links with title attribute (most reliable for headline)
    // <a href="https://www.ghanaweb.com/GhanaHomePage/business/TITLE-SLUG-123456" title="Headline Here">
    const titleAttrPattern = /<a[^>]+href="(https?:\/\/(?:www\.)?ghanaweb\.com\/GhanaHomePage\/business\/[^"]+\-\d+)"[^>]+title="([^"]+)"/gi;
    let match;
    
    while ((match = titleAttrPattern.exec(html)) !== null) {
      const url = match[1];
      let title = match[2].trim();
      
      // Decode HTML entities in title
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
      
      // Skip very short titles
      if (title.length < 15) continue;
      
      articleMatches.push({ url, title });
    }
    
    // Pattern 2: Links with h2/h3 inside (alternative pattern)
    // <a href="..."><div class="info"><h2>Headline</h2></div></a>
    const headingPattern = /<a[^>]+href="(https?:\/\/(?:www\.)?ghanaweb\.com\/GhanaHomePage\/business\/[^"]+\-\d+)"[^>]*>[\s\S]*?<h[23][^>]*>([^<]+)<\/h[23]>/gi;
    
    while ((match = headingPattern.exec(html)) !== null) {
      const url = match[1];
      let title = match[2].trim();
      
      // Decode HTML entities
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
      
      if (title.length < 15) continue;
      
      articleMatches.push({ url, title });
    }
    
    console.log(`GhanaWeb: Found ${articleMatches.length} article matches before dedup`);
    
    // Deduplicate by URL (keep first occurrence which typically has best title)
    const seenUrls = new Set<string>();
    const uniqueArticles = articleMatches.filter(a => {
      if (seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });
    
    console.log(`GhanaWeb: Found ${uniqueArticles.length} unique article links`);
    
    // Limit to first 15 articles to avoid overloading
    const articlesToProcess = uniqueArticles.slice(0, 15);
    
    // For each article, use current time as pubDate estimate
    const now = new Date();
    
    for (const item of articlesToProcess) {
      articles.push({
        title: item.title,
        link: item.url,
        pubDate: now.toISOString(),
        description: "",
        source_name: "GhanaWeb Business",
      });
    }
    
    console.log(`GhanaWeb: Returning ${articles.length} articles for processing`);
    
  } catch (error) {
    console.log(`GhanaWeb scrape error:`, error instanceof Error ? error.message : "Unknown error");
  }
  
  return articles;
}

// ============================================
// GHANAWEB OPINIONS HTML SCRAPER
// Fetches the opinions page and extracts article links/headlines
// No numbers rule - opinion pieces don't require statistics
// ============================================
async function scrapeGhanaWebOpinions(timeout = 15000): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch("https://www.ghanaweb.com/GhanaHomePage/opinions/", {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`GhanaWeb Opinions scrape failed: ${response.status}`);
      return articles;
    }
    
    const html = await response.text();
    console.log(`GhanaWeb Opinions HTML fetched: ${html.length} chars`);
    
    // Debug: Log a sample of the HTML to understand the structure
    const featuresSample = html.match(/features\/[^"'\s>]{10,100}/g);
    console.log(`GhanaWeb Opinions: Sample feature links found: ${JSON.stringify(featuresSample?.slice(0, 5) || [])}`);
    
    // Debug: Log raw href patterns to understand the format
    const hrefSample = html.match(/href="[^"]*features[^"]*"/g);
    console.log(`GhanaWeb Opinions: Sample hrefs: ${JSON.stringify(hrefSample?.slice(0, 5) || [])}`);
    
    // Find all article links with their titles
    const articleMatches: Array<{ url: string; title: string }> = [];
    
    // Pattern 1: Links to /features/ with any text content (the actual format on GhanaWeb)
    const featureLinkPattern = /<a[^>]+href="((?:https?:\/\/(?:www\.)?ghanaweb\.com)?\/GhanaHomePage\/features\/([^"]+\-\d+))"[^>]*>/gi;
    let match;
    
    while ((match = featureLinkPattern.exec(html)) !== null) {
      let url = match[1];
      const slug = match[2];
      
      // Clean up URL if relative
      if (url.startsWith('/')) {
        url = `https://www.ghanaweb.com${url}`;
      }
      
      // Extract title from slug: "Why-galamsey-persists-2018681" -> "Why galamsey persists"
      let title = slug.replace(/\-\d+$/, '').replace(/-/g, ' ').trim();
      
      // Capitalize first letter of each sentence
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      if (title.length < 15) continue;
      
      articleMatches.push({ url, title });
    }
    
    console.log(`GhanaWeb Opinions: Found ${articleMatches.length} article matches before dedup`);
    console.log(`GhanaWeb Opinions: First 3 matches: ${JSON.stringify(articleMatches.slice(0, 3))}`);
    
    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueArticles = articleMatches.filter(a => {
      if (seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });
    
    console.log(`GhanaWeb Opinions: Found ${uniqueArticles.length} unique article links`);
    
    // Limit to first 10 articles for opinions
    const articlesToProcess = uniqueArticles.slice(0, 10);
    
    const now = new Date();
    
    for (const item of articlesToProcess) {
      articles.push({
        title: item.title,
        link: item.url,
        pubDate: now.toISOString(),
        description: "",
        source_name: "GhanaWeb Opinions",
        is_opinion: true,
      });
    }
    
    console.log(`GhanaWeb Opinions: Returning ${articles.length} articles for processing`);
    
  } catch (error) {
    console.log(`GhanaWeb Opinions scrape error:`, error instanceof Error ? error.message : "Unknown error");
  }
  
  return articles;
}

// Log candidate to audit table
async function logCandidate(
  supabase: any,
  runId: string,
  article: { title: string; link: string; pubDate: string; description: string; source_name: string },
  decision: string,
  rejectionCode: string | null,
  rejectionDetail: string | null,
  extras: {
    fullText?: string | null;
    pubDateParsed?: Date | null;
    dedupeKey?: string;
    dedupeMatchedArticleId?: string;
    dedupeMatchedCandidateId?: string;
    dedupeSimilarityEvidence?: any;
    numbersFound?: string[];
    newsroomArticleId?: string;
  } = {}
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("newsroom_candidates")
      .insert({
        run_id: runId,
        source_name: article.source_name,
        source_url: article.link,
        headline: article.title.substring(0, 500),
        rss_summary: article.description?.substring(0, 1000) || null,
        fetched_full_text: extras.fullText?.substring(0, 2000) || null,
        pub_date_raw: article.pubDate,
        pub_date_parsed: extras.pubDateParsed?.toISOString() || null,
        decision,
        rejection_code: rejectionCode,
        rejection_detail: rejectionDetail?.substring(0, 500) || null,
        dedupe_key: extras.dedupeKey || null,
        dedupe_matched_article_id: extras.dedupeMatchedArticleId || null,
        dedupe_matched_candidate_id: extras.dedupeMatchedCandidateId || null,
        dedupe_similarity_evidence: extras.dedupeSimilarityEvidence || null,
        numbers_found: extras.numbersFound || null,
        newsroom_article_id: extras.newsroomArticleId || null,
      })
      .select("id")
      .single();
    
    if (error) {
      console.log(`Failed to log candidate: ${error.message}`);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.log(`Candidate logging error:`, err);
    return null;
  }
}

// Update source health tracking
async function updateSourceHealth(
  supabase: any,
  sourceName: string,
  success: boolean,
  itemCount: number,
  errorMessage?: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    if (success) {
      // First get current count to increment
      const { data: current } = await supabase
        .from("newsroom_sources")
        .select("total_items_seen")
        .eq("name", sourceName)
        .single();
      
      const currentCount = current?.total_items_seen || 0;
      
      await supabase
        .from("newsroom_sources")
        .update({
          last_success_at: now,
          last_item_at: itemCount > 0 ? now : undefined,
          consecutive_errors: 0,
          total_items_seen: currentCount + itemCount,
          updated_at: now,
        })
        .eq("name", sourceName);
    } else {
      // Increment error count
      const { data } = await supabase
        .from("newsroom_sources")
        .select("consecutive_errors")
        .eq("name", sourceName)
        .single();
      
      const currentErrors = data?.consecutive_errors || 0;
      
      await supabase
        .from("newsroom_sources")
        .update({
          last_error_at: now,
          last_error_message: errorMessage?.substring(0, 500),
          consecutive_errors: currentErrors + 1,
          updated_at: now,
        })
        .eq("name", sourceName);
    }
  } catch (err) {
    console.log(`Source health update error for ${sourceName}:`, err);
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
    const perSourceLimit = Number(body.perSourceLimit ?? body.per_source_limit ?? 5);
    const isBackfill = triggerType === "fast_publish_backfill";
    const isReprocess = body.reprocessPending === true || body.reprocess_pending === true;
    const maxArticlesPerRun = Number(body.maxArticlesPerRun ?? body.max_articles_per_run ?? DEFAULT_MAX_ARTICLES_PER_RUN);
    // Allow extended time window for backfill (default 168 hours = 7 days)
    const timeWindowHours = isBackfill 
      ? Number(body.timeWindowHours ?? body.time_window_hours ?? 168)
      : TIME_WINDOW_HOURS;
    // Optional source filter for targeted backfill
    const targetSource = body.targetSource ?? body.target_source ?? null;

    const sourceNameToDomain = new Map<string, string>();
    for (const s of RSS_SOURCES) sourceNameToDomain.set(s.name, s.domain);
    // Add GhanaWeb to domain mapping (scraped, not RSS)
    sourceNameToDomain.set("GhanaWeb Business", "ghanaweb.com");
    sourceNameToDomain.set("GhanaWeb Opinions", "ghanaweb.com");

    const isFastPublishSource = (sourceName: string): boolean => {
      const domain = sourceNameToDomain.get(sourceName);
      return domain ? FAST_PUBLISH_DOMAINS.has(domain) : false;
    };

    const isOpinionSource = (sourceName: string): boolean => {
      return sourceName === "GhanaWeb Opinions";
    };

    // ============================================
    // REPROCESS PENDING MODE
    // Re-process existing newsroom_articles with status 'pending' or 'failed'
    // ============================================
    if (isReprocess) {
      console.log(`REPROCESS MODE: Looking for pending/failed articles${targetSource ? ` from ${targetSource}` : ''}`);
      
      let query = supabase
        .from("newsroom_articles")
        .select("*")
        .in("processing_status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(maxArticlesPerRun);
      
      if (targetSource) {
        query = query.ilike("source_name", `%${targetSource}%`);
      }
      
      const { data: pendingItems, error: pendingError } = await query;
      
      if (pendingError) {
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to fetch pending items: ${pendingError.message}`,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (!pendingItems || pendingItems.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "No pending articles to reprocess.",
          articles_reprocessed: 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`Found ${pendingItems.length} pending articles to reprocess`);
      
      let articlesCreated = 0;
      
      for (const newsItem of pendingItems) {
        try {
          console.log(`Reprocessing: ${newsItem.original_headline.substring(0, 60)}...`);
          
          await supabase.from("newsroom_articles").update({
            processing_status: "processing",
          }).eq("id", newsItem.id);
          
          // Fetch full text from source URL
          let fullText = "";
          if (newsItem.source_url) {
            try {
              const pageResp = await fetch(newsItem.source_url, {
                headers: { "User-Agent": "StatsGH-Bot/1.0" },
              });
              if (pageResp.ok) {
                const html = await pageResp.text();
                // Extract text content
                fullText = html
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .substring(0, 8000);
              }
            } catch (fetchErr) {
              console.log(`Failed to fetch source URL: ${fetchErr}`);
            }
          }
          
          if (!fullText) {
            fullText = `${newsItem.original_headline} ${newsItem.original_summary || ""}`;
          }
          
          const isOpinionItem = isOpinionSource(newsItem.source_name);
          
          // Choose the appropriate prompt
          let articlePrompt: string;
          
          if (isOpinionItem) {
            articlePrompt = `You are rewriting an opinion piece into VERY BASIC ENGLISH for StatsGH readers.

ORIGINAL TEXT:
Title: ${newsItem.original_headline}
Source: ${newsItem.source_name}
URL: ${newsItem.source_url}

FULL TEXT:
${fullText.substring(0, 4000)}

YOUR ONLY JOB: Make this opinion piece EASY TO READ. Break it into very simple language.

RULES FOR VERY BASIC ENGLISH:
1. Use ONLY simple words a child can understand:
   - "use" NOT "utilize"
   - "get" NOT "obtain"  
   - "help" NOT "facilitate"
   - "start" NOT "commence"
   - "buy" NOT "purchase"
   - "about" NOT "regarding"
   - "show" NOT "demonstrate"
   - "think" NOT "consider"
   - "need" NOT "require"
   - "end" NOT "terminate"

2. Write SHORT sentences. One idea = one sentence. Max 15 words per sentence.

3. EXPLAIN hard words in brackets right after you use them:
   - "sovereignty (a country's right to rule itself)"
   - "bilateral (between two countries)"
   - "inflation (when prices go up)"
   - "fiscal (about government money)"
   - "GDP (the total value of everything a country makes)"

4. Keep the writer's ORIGINAL ARGUMENT. Do not change their opinion. Just make it easier to read.

5. Break into SHORT PARAGRAPHS. 2-3 sentences each. Use line breaks.

6. Do NOT add numbers or statistics unless they are in the original text.

OUTPUT (valid JSON only):
{
  "reject": false,
  "headline": "Clear headline about the opinion, max 80 characters, no colons",
  "subtitle": "One simple sentence about what this opinion says",
  "article_body_html": "The FULL opinion piece rewritten in very basic English. Use <p> tags for paragraphs. Keep ALL the original arguments and points. Just make the words simpler and sentences shorter.",
  "takeaway": "One sentence: what is the writer's main point?",
  "tweet": "One sentence about this opinion, no URLs",
  "source_url": "${newsItem.source_url}",
  "seo_description": "SEO description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "opinion",
  "tags": ["opinion", "ghana"],
  "image_prompt": "Visual for editorial art, max 50 words, no text/logos/faces",
  "author_name": "The opinion writer's name if you can find it in the text"
}

If text is too short or not really an opinion, return:
{"reject": true, "reason": "why"}

Return ONLY valid JSON.`;
          } else {
            // Standard news prompt - skip for now in reprocess mode (focus on opinions)
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: "Reprocess mode currently only supports opinion articles",
            }).eq("id", newsItem.id);
            continue;
          }
          
          // Call GPT
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: articlePrompt }],
            temperature: 0.3,
          });
          
          const rawContent = response.choices[0]?.message?.content || "";
          let articleJson: any;
          
          try {
            const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              articleJson = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("No JSON found in response");
            }
          } catch (parseErr) {
            console.error("Failed to parse GPT response:", parseErr);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: `GPT response parse error: ${parseErr}`,
            }).eq("id", newsItem.id);
            continue;
          }
          
          if (articleJson.reject === true) {
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: `Editorial rejection: ${articleJson.reason || "Unknown reason"}`,
            }).eq("id", newsItem.id);
            continue;
          }
          
          // Clean up the article body
          let articleBody = collapseImmediateWordRepeats(articleJson.article_body_html || "");
          const takeaway = collapseImmediateWordRepeats(articleJson.takeaway || "");
          
          // Add takeaway footer
          if (takeaway) {
            articleBody += `\n\n<p><strong>Writer's main point:</strong> ${takeaway}</p>`;
          }
          
          // Get/create category
          const section = "opinion";
          let categoryId: string | null = null;
          
          const { data: existingCat } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", section)
            .limit(1);
          
          if (existingCat && existingCat.length > 0) {
            categoryId = existingCat[0].id;
          } else {
            const { data: newCat } = await supabase
              .from("categories")
              .insert({ name: "Opinion", slug: section, color: "#6B7280" })
              .select()
              .single();
            if (newCat) categoryId = newCat.id;
          }
          
          // Generate a unique slug
          const baseSlug = (articleJson.slug || "opinion-article").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
          const uniqueSlug = `${baseSlug}-${Date.now()}`;
          
          // Create the article
          const authorName = articleJson.author_name || "StatsGH Newsroom";
          const headline = collapseImmediateWordRepeats(articleJson.headline || newsItem.original_headline);
          
          const { data: newArticle, error: articleError } = await supabase
            .from("articles")
            .insert({
              title: headline,
              slug: uniqueSlug,
              summary: articleJson.subtitle || "",
              body: articleBody,
              author_name: authorName,
              category_slug: section,
              category_id: categoryId,
              section: section,
              seo_description: articleJson.seo_description || "",
              tags: articleJson.tags || ["opinion", "ghana"],
              twitter_post: articleJson.tweet || "",
              is_published: true,
              published_at: new Date().toISOString(),
              is_wire: true,
              dedupe_key: newsItem.dedupe_key,
            })
            .select()
            .single();
          
          if (articleError) {
            console.error(`Failed to save article: ${articleError.message}`);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: `Save error: ${articleError.message}`,
            }).eq("id", newsItem.id);
            continue;
          }
          
          await supabase.from("newsroom_articles").update({
            processing_status: "completed",
            generated_article_id: newArticle.id,
          }).eq("id", newsItem.id);
          
          articlesCreated++;
          console.log(`✓ Created opinion article: ${headline}`);
          
        } catch (err) {
          console.error(`Error reprocessing: ${err}`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `Reprocess error: ${err}`,
          }).eq("id", newsItem.id);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: `Reprocessed ${pendingItems.length} articles, created ${articlesCreated}`,
        articles_found: pendingItems.length,
        articles_created: articlesCreated,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    console.log(`Started newsroom run: ${run.id}, timeWindow: ${timeWindowHours}h, targetSource: ${targetSource || 'all'}`);

    // ============================================
    // FETCH RSS FEEDS FROM ALL SOURCES
    // ============================================
    const cutoffTime = hoursAgo(timeWindowHours);
    console.log(`Fetching RSS feeds, cutoff time: ${cutoffTime.toISOString()}`);

    const allArticles: Array<{
      title: string;
      link: string;
      pubDate: string;
      description: string;
      source_name: string;
    }> = [];

    // Fetch all RSS feeds in parallel with health tracking
    // Filter sources: backfill uses fast-publish domains, can target specific source
    const sourcesToFetch = isBackfill
      ? RSS_SOURCES.filter((s) => {
          const isFast = FAST_PUBLISH_DOMAINS.has(s.domain);
          const matchesTarget = !targetSource || s.name.toLowerCase().includes(targetSource.toLowerCase()) || s.domain.includes(targetSource.toLowerCase());
          return isFast && matchesTarget;
        })
      : RSS_SOURCES;

    const feedPromises = sourcesToFetch.map(async (source) => {
      console.log(`Fetching RSS from ${source.name}: ${source.rss}`);
      const xml = await fetchRssFeed(source.rss);
      if (xml) {
        const items = parseRssXml(xml, source.name);
        console.log(`${source.name}: Found ${items.length} items`);
        await updateSourceHealth(supabase, source.name, true, items.length);
        return items;
      } else {
        await updateSourceHealth(supabase, source.name, false, 0, "RSS fetch failed");
      }
      return [];
    });

    const feedResults = await Promise.all(feedPromises);
    feedResults.forEach(items => allArticles.push(...items));

    console.log(`Total RSS items fetched: ${allArticles.length}`);

    // ============================================
    // FETCH GHANAWEB VIA HTML SCRAPING (no RSS available)
    // ============================================
    const shouldScrapeGhanaWeb = !targetSource || 
      targetSource.toLowerCase().includes("ghanaweb") || 
      targetSource.toLowerCase().includes("ghana web");
    
    if (shouldScrapeGhanaWeb) {
      console.log("Scraping GhanaWeb Business page...");
      const ghanaWebArticles = await scrapeGhanaWebBusiness();
      allArticles.push(...ghanaWebArticles);
      
      // Update source health for GhanaWeb Business
      if (ghanaWebArticles.length > 0) {
        await updateSourceHealth(supabase, "GhanaWeb Business", true, ghanaWebArticles.length);
      } else {
        await updateSourceHealth(supabase, "GhanaWeb Business", false, 0, "HTML scrape returned no articles");
      }

      // Scrape GhanaWeb Opinions
      console.log("Scraping GhanaWeb Opinions page...");
      const ghanaWebOpinions = await scrapeGhanaWebOpinions();
      allArticles.push(...ghanaWebOpinions);
      
      // Update source health for GhanaWeb Opinions
      if (ghanaWebOpinions.length > 0) {
        await updateSourceHealth(supabase, "GhanaWeb Opinions", true, ghanaWebOpinions.length);
      } else {
        await updateSourceHealth(supabase, "GhanaWeb Opinions", false, 0, "HTML scrape returned no articles");
      }
    }

    console.log(`Total items after scraping: ${allArticles.length}`);

    // ============================================
    // PROCESS EACH ARTICLE WITH FULL AUDIT TRAIL
    // ============================================
    const qualifyingArticles: Array<{
      title: string;
      link: string;
      pubDate: string;
      description: string;
      source_name: string;
      _pubDateParsed: Date;
      _fullText: string;
      _numbersFound: string[];
      _dedupeKey: string;
      _dedupeKeyRaw: string;
      _isOpinion?: boolean;
    }> = [];

    // Enforce per-source quota (used for backfill: e.g., 5 per outlet)
    const perSourceCounts = new Map<string, number>();

    for (const article of allArticles) {
      const isFast = isFastPublishSource(article.source_name);
      const isOpinion = isOpinionSource(article.source_name);
      if (isBackfill && !isFast && !isOpinion) continue;

      if (isBackfill) {
        const current = perSourceCounts.get(article.source_name) ?? 0;
        if (current >= perSourceLimit) continue;
        perSourceCounts.set(article.source_name, current + 1);
      }

      // Parse publication date
      let pubDate: Date | null = null;
      try {
        pubDate = new Date(article.pubDate);
        if (isNaN(pubDate.getTime())) pubDate = null;
      } catch {
        pubDate = null;
      }

      // Log if date parsing failed
      if (!pubDate) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.PUBDATE_PARSE_FAILED, 
          `Could not parse date: ${article.pubDate}`, { pubDateParsed: null });
        continue;
      }

      // Check time window
      if (pubDate < cutoffTime) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.OUTSIDE_TIME_WINDOW,
          `Published ${Math.round((nowUtc().getTime() - pubDate.getTime()) / (1000 * 60 * 60))}h ago, cutoff is ${TIME_WINDOW_HOURS}h`,
          { pubDateParsed: pubDate });
        continue;
      }

      // Check if business-related (skipped for fast-publish and opinion sources)
      const rssText = `${article.title} ${article.description}`;
      if (!isFast && !isOpinion && !isBusinessRelated(rssText)) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.NOT_BUSINESS,
          "No business keywords found in headline/summary", { pubDateParsed: pubDate });
        continue;
      }

      // CRITICAL: Check if content is relevant to Ghana (applies to ALL sources including fast-publish)
      // Opinion articles from GhanaWeb are inherently Ghana-relevant by source
      // This prevents international press releases from being published
      if (!isOpinion && !isGhanaRelevant(rssText)) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.NOT_GHANA_RELEVANT,
          "Content does not mention Ghana or Ghanaian entities", { pubDateParsed: pubDate });
        continue;
      }

      // Check crime filter (skipped for fast-publish and opinion sources)
      if (!isFast && !isOpinion && isCrimeNews(rssText)) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.CRIME_FILTER,
          "Contains crime keywords without statistical context", { pubDateParsed: pubDate });
        continue;
      }

      // Check political gossip filter (skipped for fast-publish and opinion sources - opinions can be political)
      if (!isFast && !isOpinion && isPoliticalGossip(rssText)) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.POLITICAL_GOSSIP,
          "Political drama/gossip without data substance", { pubDateParsed: pubDate });
        continue;
      }

      // Check if RSS has numbers - if not, fetch full page (skipped for fast-publish and opinion sources)
      // OPINION articles don't require numbers
      let fullText = rssText;
      let numbersFound = extractNumbers(rssText);

      if (!isFast && !isOpinion && !containsNumbers(rssText)) {
        console.log(`RSS has no numbers, fetching full page: ${article.link}`);
        const pageText = await fetchFullPageText(article.link);
        
        if (!pageText) {
          await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.FULL_PAGE_FETCH_FAILED,
            "RSS had no numbers, full page fetch failed", { pubDateParsed: pubDate, numbersFound: [] });
          continue;
        }
        
        fullText = `${rssText} ${pageText}`;
        numbersFound = extractNumbers(fullText);
        
        if (!containsNumbers(fullText)) {
          await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.NO_NUMBERS_IN_FULL_PAGE,
            "No numbers found in RSS or full page content", 
            { pubDateParsed: pubDate, fullText: pageText.substring(0, 1000), numbersFound: [] });
          continue;
        }
        
        console.log(`Full page has numbers: ${numbersFound.slice(0, 5).join(", ")}`);
      }

      // For opinion articles, fetch full page text for restructuring
      if (isOpinion && !fullText.includes(article.link)) {
        console.log(`Opinion article: Fetching full page for: ${article.link}`);
        const pageText = await fetchFullPageText(article.link);
        if (pageText) {
          fullText = `${rssText} ${pageText}`;
        }
      }

      // Generate dedupe key
      const dateStr = pubDate.toISOString().split("T")[0];
      const dedupeKeyRaw = buildDedupeKey(article.title, article.source_name, dateStr, numbersFound);
      const dedupeKeyHash = await sha256Hex(dedupeKeyRaw);

      // Check for duplicates in newsroom_articles
      const { data: seenNewsroom } = await supabase
        .from("newsroom_articles")
        .select("id, original_headline")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seenNewsroom && seenNewsroom.length > 0) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.DEDUPED_NEWSROOM,
          `Matched existing newsroom article`, {
            pubDateParsed: pubDate,
            dedupeKey: dedupeKeyHash,
            dedupeSimilarityEvidence: { 
              matched_headline: seenNewsroom[0].original_headline,
              dedupe_key_raw: dedupeKeyRaw 
            },
            numbersFound,
          });
        continue;
      }

      // Check for duplicates in published articles
      const { data: seenPublished } = await supabase
        .from("articles")
        .select("id, title")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seenPublished && seenPublished.length > 0) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.DEDUPED_ARTICLES,
          `Matched existing published article`, {
            pubDateParsed: pubDate,
            dedupeKey: dedupeKeyHash,
            dedupeMatchedArticleId: seenPublished[0].id,
            dedupeSimilarityEvidence: { 
              matched_title: seenPublished[0].title,
              dedupe_key_raw: dedupeKeyRaw 
            },
            numbersFound,
          });
        continue;
      }

      // Article passes all filters - add to qualifying list
      qualifyingArticles.push({
        ...article,
        _pubDateParsed: pubDate,
        _fullText: fullText,
        _numbersFound: numbersFound,
        _dedupeKey: dedupeKeyHash,
        _dedupeKeyRaw: dedupeKeyRaw,
        _isOpinion: isOpinion,
      });
    }

    console.log(`Qualifying articles: ${qualifyingArticles.length} (${qualifyingArticles.filter(a => a._isOpinion).length} opinion)`);

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

    // Limit number of queued items to avoid timeouts.
    // For backfill, we queue up to (perSourceLimit * number of fast sources), but still only
    // process maxArticlesPerRun items in this invocation.
    const queueCap = isBackfill
      ? Math.min(qualifyingArticles.length, Math.max(1, perSourceLimit) * sourcesToFetch.length)
      : Math.min(qualifyingArticles.length, 10);

    const toProcess = qualifyingArticles.slice(0, queueCap);

    // Insert pending records
    const newsRecords = toProcess.map((item) => ({
      run_id: run.id,
      source_name: item.source_name,
      original_headline: item.title,
      original_summary: item.description || "",
      source_url: item.link,
      published_at: item._pubDateParsed.toISOString(),
      category_hint: null,
      dedupe_key: item._dedupeKey,
      processing_status: "pending",
    }));

    const { data: insertedNews, error: insertError } = await supabase
      .from("newsroom_articles")
      .insert(newsRecords)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert newsroom items: ${insertError.message}`);
    }

    // Log accepted candidates
    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      const newsroomId = insertedNews?.[i]?.id;
      await logCandidate(supabase, run.id, item, "accepted", null, null, {
        pubDateParsed: item._pubDateParsed,
        fullText: item._fullText.length > 500 ? item._fullText.substring(0, 500) + "..." : item._fullText,
        dedupeKey: item._dedupeKey,
        numbersFound: item._numbersFound,
        newsroomArticleId: newsroomId,
      });
    }

    await supabase.from("newsroom_runs").update({
      articles_found: insertedNews?.length || 0,
    }).eq("id", run.id);

    // ============================================
    // PROCESS EACH ITEM INTO STATSGH ARTICLE FORMAT
    // ============================================
    let articlesCreated = 0;
    const itemsToProcess = (insertedNews || []).slice(0, maxArticlesPerRun);

    for (let idx = 0; idx < itemsToProcess.length; idx++) {
      const newsItem = itemsToProcess[idx];
      const originalItem = toProcess[idx];
      
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
        const isFastPublishItem = isFastPublishSource(newsItem.source_name);
        const isOpinionItem = originalItem._isOpinion === true;

        // ============================================
        // MASTER RULE: SOURCE MUST HAVE NUMBERS (except for opinion articles)
        // This applies to ALL sources including fast-publish, but NOT opinion
        // ============================================
        const sourceNumbers = originalItem._numbersFound || [];
        if (!isOpinionItem && (sourceNumbers.length === 0 || !containsNumbers(originalItem._fullText))) {
          console.log(`MASTER RULE REJECTION: "${newsItem.original_headline.substring(0, 50)}..." - Source has NO NUMBERS`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `Master rule: Source contains no numbers - not StatsGH material`,
          }).eq("id", newsItem.id);
          continue;
        }

        // Choose the appropriate prompt based on whether this is an opinion piece
        let articlePrompt: string;
        
        if (isOpinionItem) {
          // ============================================
          // OPINION ARTICLE PROMPT - BYPASS MASTER RULE
          // Focus ONLY on Very Basic English restructuring
          // No numbers required, no data requirements
          // ============================================
          articlePrompt = `You are rewriting an opinion piece into VERY BASIC ENGLISH for StatsGH readers.

ORIGINAL TEXT:
Title: ${newsItem.original_headline}
Source: ${newsItem.source_name}
URL: ${newsItem.source_url}

FULL TEXT:
${originalItem._fullText.substring(0, 4000)}

YOUR ONLY JOB: Make this opinion piece EASY TO READ. Break it into very simple language.

RULES FOR VERY BASIC ENGLISH:
1. Use ONLY simple words a child can understand:
   - "use" NOT "utilize"
   - "get" NOT "obtain"  
   - "help" NOT "facilitate"
   - "start" NOT "commence"
   - "buy" NOT "purchase"
   - "about" NOT "regarding"
   - "show" NOT "demonstrate"
   - "think" NOT "consider"
   - "need" NOT "require"
   - "end" NOT "terminate"

2. Write SHORT sentences. One idea = one sentence. Max 15 words per sentence.

3. EXPLAIN hard words in brackets right after you use them:
   - "sovereignty (a country's right to rule itself)"
   - "bilateral (between two countries)"
   - "inflation (when prices go up)"
   - "fiscal (about government money)"
   - "GDP (the total value of everything a country makes)"

4. Keep the writer's ORIGINAL ARGUMENT. Do not change their opinion. Just make it easier to read.

5. Break into SHORT PARAGRAPHS. 2-3 sentences each. Use line breaks.

6. Do NOT add numbers or statistics unless they are in the original text.

OUTPUT (valid JSON only):
{
  "reject": false,
  "headline": "Clear headline about the opinion, max 80 characters, no colons",
  "subtitle": "One simple sentence about what this opinion says",
  "article_body_html": "The FULL opinion piece rewritten in very basic English. Use <p> tags for paragraphs. Keep ALL the original arguments and points. Just make the words simpler and sentences shorter.",
  "takeaway": "One sentence: what is the writer's main point?",
  "tweet": "One sentence about this opinion, no URLs",
  "source_url": "${newsItem.source_url}",
  "seo_description": "SEO description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "opinion",
  "tags": ["opinion", "ghana"],
  "image_prompt": "Visual for editorial art, max 50 words, no text/logos/faces",
  "author_name": "The opinion writer's name if you can find it in the text"
}

If text is too short or not really an opinion, return:
{"reject": true, "reason": "why"}

Return ONLY valid JSON.`;
        } else {
          // ============================================
          // STANDARD NEWS ARTICLE PROMPT - Numbers required
          // ============================================
          articlePrompt = `You are the StatsGH automated newsroom editor. StatsGH is a DATA-DRIVEN news platform - EVERY article MUST contain meaningful numbers FROM THE SOURCE.

ORIGINAL NEWS ITEM:
Headline: ${newsItem.original_headline}
Summary: ${newsItem.original_summary}
Source: ${newsItem.source_name}
URL: ${newsItem.source_url}
Published: ${newsItem.published_at}

ADDITIONAL CONTEXT (extracted from full page if RSS was thin):
${originalItem._fullText.substring(0, 2000)}

Numbers found in source: ${originalItem._numbersFound.join(", ")}

CRITICAL RULES - READ CAREFULLY:

1. SOURCE MUST CONTAIN NUMBERS:
- If the source news has NO numbers (amounts, percentages, rates, counts), respond with: {"reject": true, "reason": "Source contains no numbers"}
- DO NOT make up numbers. DO NOT invent data. DO NOT fabricate statistics.
- Only use numbers that are IN the source OR well-known Ghana statistics for context.

2. *** MASTER RULE: HEADLINE MUST CONTAIN A NUMBER *** (NO EXCEPTIONS):
- The headline MUST include at least one number from the original story.
- This is the #1 rule of StatsGH. No number in headline = no publish.
- Examples of GOOD headlines: "Ghana GDP Grows 4.7% in Q3 2025", "BoG Holds Policy Rate at 27%", "Cocoa Exports Hit $2.1 Billion", "Poverty Drops to 21.9%"
- Examples of BAD headlines: "Government Announces New Policy", "Minister Visits Factory" (no numbers!)
- If you cannot create a headline with a number from the source, reject the article.

3. ADDING GHANA CONTEXT (NOT MAKING UP DATA):
- After presenting the source facts, you MAY add well-known Ghana statistics for context.
- Only use REAL, verifiable Ghana statistics you are confident about.
- Mark context clearly: "For context, Ghana's GDP is approximately $77 billion."
- If you're not sure about a statistic, DO NOT include it.
- NEVER invent or estimate numbers. If unsure, leave it out.

LANGUAGE RULES - VERY BASIC ENGLISH:
- Use the simplest words possible. Write for someone learning English.
- Short sentences only. One idea per sentence.
- Avoid complex words. Use "buy" not "purchase". Use "help" not "facilitate". Use "start" not "commence".
- If you must use a technical term (GDP, inflation, policy rate, bilateral), DEFINE IT in brackets immediately after.
- Example: "The GDP (the total value of goods and services a country produces) grew by 4.7%."
- Example: "The policy rate (the interest rate the central bank charges other banks) stayed at 27%."
- No jargon. No fancy words. Explain everything simply.

OUTPUT STYLE RULES:
- Write in simple, plain English that a reader with basic English can understand.
- Short sentences. Clear subject and verb. Neutral tone.
- No emojis. No hashtags. No long dashes. No bullet symbols.
- Do not include any URLs inside the article body or tweet.
- Use GHS for Ghana cedi amounts.
- Use % for percentages.

FACT INTEGRITY - ABSOLUTE:
- NEVER invent, fabricate, or conjure data.
- Only use numbers from the source article.
- For Ghana context, only use well-known statistics you are confident about.
- If the source lacks numbers, REJECT the article. Do not publish without source numbers.

ARTICLE STRUCTURE (only if source has numbers):

HEADLINE: One short line with a NUMBER FROM THE SOURCE, max 80 characters. THIS IS MANDATORY.

ARTICLE:
- Paragraph 1 explains what happened and why it matters. Use simple words.
- Paragraph 2 adds context in simple terms. Define any technical terms.

KEY NUMBERS AT A GLANCE:
- List the key numbers FROM THE SOURCE (minimum 3).
- You may add 1-2 lines of Ghana context statistics if relevant and you're confident they're accurate.
- Each line must include a specific number.
- Keep each line short.

Then write 2 to 3 short paragraphs explaining what the numbers mean in real life. Use very simple language.

End with one clear takeaway sentence.

TWEET: One sentence only. Must contain a number from the story. No URLs.

OUTPUT (valid JSON only):

If source has no numbers OR you cannot create a headline with a number, return:
{"reject": true, "reason": "Explain why"}

If source has numbers, return:
{
  "reject": false,
  "headline": "Max 80 characters, MUST CONTAIN A NUMBER FROM SOURCE (mandatory), factual, no colons",
  "subtitle": "One-sentence expansion of the headline",
  "article_intro": "Paragraph 1: what happened and why it matters (simple English)",
  "article_context": "Paragraph 2: context in simple terms (define technical words)",
  "key_numbers": ["Array of number lines FROM THE SOURCE, minimum 3 required"],
  "numbers_explanation": "2-3 short paragraphs explaining what the numbers mean (very simple language)",
  "takeaway": "One clear takeaway sentence",
  "tweet": "One sentence with a number from the story, no URLs",
  "source_url": "${newsItem.source_url}",
  "seo_description": "SEO meta description under 155 characters",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "section": "A category slug like: ${PREFERRED_CATEGORIES.join(", ")} - or suggest a new one in kebab-case",
  "tags": ["array", "of", "relevant", "tags"],
  "image_prompt": "Visual description for editorial illustration, max 50 words, no text/logos/real people"
}

Return ONLY valid JSON.`;
        }

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
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `AI returned invalid JSON`,
          }).eq("id", newsItem.id);
          continue;
        }

        // Guardrail: collapse accidental repeated words in AI fields (e.g., "not not").
        // This prevents visible glitches in headlines/summaries and also reduces downstream duplication.
        const cleanStr = (v: unknown) => typeof v === "string" ? collapseImmediateWordRepeats(v) : v;
        articleJson.headline = cleanStr(articleJson.headline);
        articleJson.subtitle = cleanStr(articleJson.subtitle);
        articleJson.article_intro = cleanStr(articleJson.article_intro);
        articleJson.article_context = cleanStr(articleJson.article_context);
        articleJson.numbers_explanation = cleanStr(articleJson.numbers_explanation);
        articleJson.takeaway = cleanStr(articleJson.takeaway);
        articleJson.tweet = cleanStr(articleJson.tweet);
        articleJson.seo_description = cleanStr(articleJson.seo_description);
        articleJson.slug = cleanStr(articleJson.slug);
        articleJson.section = cleanStr(articleJson.section);
        // Opinion articles use article_body_html instead of component parts
        articleJson.article_body_html = cleanStr(articleJson.article_body_html);
        articleJson.author_name = cleanStr(articleJson.author_name);

        if (Array.isArray(articleJson.key_numbers)) {
          articleJson.key_numbers = articleJson.key_numbers
            .map((n: unknown) => (typeof n === "string" ? collapseImmediateWordRepeats(n) : n))
            .filter((n: unknown) => typeof n === "string");
        }
        if (Array.isArray(articleJson.tags)) {
          articleJson.tags = articleJson.tags
            .map((t: unknown) => (typeof t === "string" ? collapseImmediateWordRepeats(t) : t))
            .filter((t: unknown) => typeof t === "string");
        }

        // ============================================
        // CHECK IF GPT REJECTED DUE TO NO SOURCE NUMBERS
        // APPLIES TO ALL SOURCES - NO EXCEPTIONS
        // ============================================
        if (articleJson.reject === true) {
          const rejectReason = articleJson.reason || "Source contains no numbers";
          console.log(`REJECTED BY GPT: "${newsItem.original_headline.substring(0, 50)}..." - ${rejectReason}`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `Editorial rejection: ${rejectReason}`,
          }).eq("id", newsItem.id);
          continue; // Skip this article
        }

        // ============================================
        // MASTER RULE: HEADLINE MUST HAVE A NUMBER
        // APPLIES TO ALL SOURCES - NO EXCEPTIONS
        // ============================================
        const headline = String(articleJson.headline || "");
        const headlineHasNumber = /\d/.test(headline);
        
        // Opinion articles don't require numbers in headlines
        if (!isOpinionItem && !headlineHasNumber) {
          console.log(`MASTER RULE REJECTION: Headline "${headline}" has NO NUMBER - not StatsGH material`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `Master rule: Headlines must contain at least one number - this is StatsGH's core identity`,
          }).eq("id", newsItem.id);
          continue; // Skip this article
        }
        
        console.log(`MASTER RULE PASSED: Headline "${headline}" contains number ✓`);

        // ============================================
        // VALIDATE KEY NUMBERS (MINIMUM 3 REQUIRED)
        // APPLIES TO ALL SOURCES - NO EXCEPTIONS
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

        // Opinion articles don't require 3 numbers
        if (!isOpinionItem && validKeyNumbers.length < 3) {
          console.log(`MASTER RULE REJECTION: Article "${headline}" has only ${validKeyNumbers.length} valid numbers (minimum 3 required)`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `Master rule: Only ${validKeyNumbers.length} valid numbers found (minimum 3 required for StatsGH)`,
          }).eq("id", newsItem.id);
          continue; // Skip this article
        }

        console.log(`${isOpinionItem ? 'Opinion article' : `Numbers validation passed: ${validKeyNumbers.length} valid numbers found`} ✓`);

        // Build the article body - DIFFERENT FORMAT FOR OPINION vs NEWS
        let articleBody: string;
        
        if (isOpinionItem) {
          // OPINION: Use the article_body_html directly from AI (no Key Numbers section)
          const opinionBody = articleJson.article_body_html || articleJson.article_body || "";
          const takeaway = articleJson.takeaway || "";
          articleBody = `
${opinionBody}
<p><strong>Writer's main point:</strong> ${takeaway}</p>
`.trim();
          console.log(`Built OPINION article body (no Key Numbers required)`);
        } else {
          // NEWS: Build structured body with Key Numbers section
          const keyNumbersHtml = validKeyNumbers.map((n: string) => `<p>• ${n}</p>`).join("\n");
          articleBody = `
<p>${articleJson.article_intro || ""}</p>
<p>${articleJson.article_context || ""}</p>
<h3>📊 Key Numbers at a Glance</h3>
${keyNumbersHtml}
<p>${articleJson.numbers_explanation || ""}</p>
<p><strong>Takeaway:</strong> ${articleJson.takeaway || ""}</p>
`.trim();
        }

        const slugBase = String(articleJson.slug || articleJson.headline || "article")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .substring(0, 80);

        const articleSlug = `${slugBase}-${Date.now()}`;

        // ============================================
        // IMAGE PRIORITY: 1) Source Article, 2) Unsplash, 3) AI-Generated
        // Every article MUST have a bold, high-quality image
        // ============================================
        const section = await ensureCategoryExists(supabase, articleJson.section || DEFAULT_CATEGORY);
        const photoKeywords = getPhotoKeywords(section);
        
        let heroImageUrl: string | null = null;
        let imageSource = "none";

        // PRIORITY 1: Try to extract image from the source article page
        if (newsItem.source_url) {
          console.log(`Image priority 1: Fetching source page for images: ${newsItem.source_url}`);
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            
            const sourceResponse = await fetch(newsItem.source_url, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
            });
            
            clearTimeout(timeoutId);
            
            if (sourceResponse.ok) {
              const sourceHtml = await sourceResponse.text();
              const sourceImageUrl = await extractImageFromSourceHtml(sourceHtml, newsItem.source_url);
              
              if (sourceImageUrl) {
                heroImageUrl = await fetchAndUploadImage(sourceImageUrl, supabase, articleSlug);
                if (heroImageUrl) {
                  imageSource = "source";
                  console.log(`✓ Using source article image: ${heroImageUrl}`);
                }
              }
            }
          } catch (sourceErr) {
            console.log(`Source page fetch error: ${sourceErr instanceof Error ? sourceErr.message : 'Unknown'}`);
          }
        }

        // PRIORITY 2: Unsplash stock photos (if no source image)
        if (!heroImageUrl) {
          console.log(`Image priority 2: Fetching Unsplash stock photo, keywords: ${photoKeywords}`);
          
          try {
            const unsplashSourceUrl = `https://source.unsplash.com/1600x900/?${encodeURIComponent(photoKeywords)}`;
            
            const imageResponse = await fetch(unsplashSourceUrl, {
              redirect: "follow",
            });
            
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.arrayBuffer();
              const bytes = new Uint8Array(imageBlob);
              
              // Check minimum size
              if (bytes.length >= 10000) {
                const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
                const ext = contentType.includes("png") ? "png" : "jpg";
                
                const imagePath = `newsroom/${articleSlug}-stock.${ext}`;
                
                const { error: uploadError } = await supabase.storage
                  .from("media")
                  .upload(imagePath, bytes, { contentType, upsert: true });

                if (!uploadError) {
                  const { data: publicUrl } = supabase.storage
                    .from("media")
                    .getPublicUrl(imagePath);
                  heroImageUrl = publicUrl.publicUrl;
                  imageSource = "unsplash";
                  console.log(`✓ Using Unsplash stock photo: ${heroImageUrl}`);
                }
              } else {
                console.log(`Unsplash image too small (${bytes.length} bytes)`);
              }
            } else {
              console.log(`Unsplash fetch failed: ${imageResponse.status}`);
            }
          } catch (imgError) {
            console.error("Unsplash fetch error:", imgError);
          }
        }

        // PRIORITY 3: AI-generated image as last resort
        if (!heroImageUrl) {
          console.log(`Image priority 3: Generating AI image...`);
          
          const imagePrompt = articleJson.image_prompt || 
            `Professional editorial photograph: ${articleJson.headline}. African business context, Ghana, documentary style.`;
          
          heroImageUrl = await generateAiImage(imagePrompt, supabase, articleSlug);
          if (heroImageUrl) {
            imageSource = "ai-generated";
            console.log(`✓ Using AI-generated image: ${heroImageUrl}`);
          }
        }

        // Log final image status
        if (heroImageUrl) {
          console.log(`✓ Article image set (${imageSource}): ${articleSlug}`);
        } else {
          console.log(`⚠ No image available for: ${articleSlug}`);
        }

        await supabase.from("newsroom_articles").update({
          image_style: `${imageSource}:${photoKeywords}`,
        }).eq("id", newsItem.id);

        // Build summary from the intro (or subtitle for opinions)
        let summary = articleJson.article_intro || articleJson.subtitle || "";
        if (isOpinionItem && !summary) {
          // For opinions, use first part of body as summary
          const bodyText = (articleJson.article_body_html || articleJson.article_body || "")
            .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          summary = bodyText.substring(0, 300);
        }
        if (summary.length > 400) {
          summary = summary.substring(0, 397) + "...";
        }
        let seoDescription = articleJson.seo_description || "";
        if (seoDescription.length > 155) {
          seoDescription = seoDescription.substring(0, 152) + "...";
        }

        // Determine author name - for opinions, use extracted author if available
        let authorName = "StatsGH Newsroom";
        if (isOpinionItem && articleJson.author_name && articleJson.author_name.trim()) {
          authorName = articleJson.author_name.trim();
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
            author_name: authorName,
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
            is_wire: isFastPublishItem, // Mark fast-publish articles as wire content
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
        
        // Trigger AI extraction of indicator data from the article (fire-and-forget)
        (async () => {
          try {
            const extractUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-article-indicators`;
            const response = await fetch(extractUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ article_id: newArticle.id }),
            });
            const result = await response.json();
            if (result.success && result.results?.inserted > 0) {
              console.log(`Extracted ${result.results.inserted} indicator(s) from article: ${newArticle.title}`);
            }
          } catch (e) {
            console.error("Indicator extraction failed:", e);
          }
        })();
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
