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

// Section mapping — mirrors src/lib/sectionMapping.ts
const SECTION_TO_CATEGORIES: Record<string, string[]> = {
  'top-stories': ['top-stories', 'ghanacrimes', 'general', 'news'],
  'economy': ['macroeconomy', 'public-finance', 'labour-and-jobs', 'economy', 'fiscal-policy', 'monetary-policy'],
  'markets-data': ['markets', 'markets-data', 'stocks', 'forex', 'commodities'],
  'business': ['banking-and-finance', 'trade-and-industry', 'infrastructure-and-transport', 'business', 'corporate', 'sme'],
  'politics-policy': ['regulation-and-policy', 'politics-policy', 'politics', 'governance', 'parliament'],
  'energy-resources': ['energy-and-utilities', 'energy-resources', 'energy', 'oil-gas', 'mining', 'utilities'],
  'agriculture': ['agriculture-and-commodities', 'agriculture', 'farming', 'cocoa', 'food'],
  'technology': ['technology-and-digital-economy', 'technology', 'tech', 'digital', 'fintech', 'telecoms'],
  'companies': ['corporate-ghana', 'companies', 'corporate', 'banking', 'insurance'],
  'opinion-analysis': ['opinion-analysis', 'opinion', 'analysis', 'commentary', 'editorial'],
  'research': ['data-and-research', 'research', 'academic', 'report', 'survey'],
  'world': ['regional-economy', 'world', 'africa', 'international', 'global'],
};
function getSectionForCategory(categorySlug: string): string {
  for (const [section, categories] of Object.entries(SECTION_TO_CATEGORIES)) {
    if (categories.includes(categorySlug)) return section;
  }
  return 'top-stories';
}

// STATSGH NEWSROOM MASTER CONFIGURATION V2.0
// Major refactor: Qualifying numbers, not just any numbers
// ============================================
const DEFAULT_TIME_WINDOW_HOURS = 72; // V3.0: Widened to 72 hours (was 5)
const BACKFILL_TIME_WINDOW_HOURS = 168; // 7 days for backfill
const DEFAULT_MAX_ARTICLES_PER_RUN = 8; // Cap at 8 to stay within CPU limits
const AI_BATCH_SIZE = 8; // Max articles to process through AI per invocation
const DAILY_PUBLISH_LIMIT = 999; // No daily cap — publish everything that qualifies
const MAX_PAGE_FETCHES_PER_RUN = 20; // Hard cap on full-page fetches to stay within CPU time

// "Auto-pass" outlets: fully trusted — bypass ALL editorial filters (crime, politics, number requirements)
const AUTO_PASS_DOMAINS = new Set<string>([
  "citibusinessnews.com",
  "myjoyonline.com", // covers both JoyBiz and MyJoyOnline
]);

// "Fast publish" outlets: trusted sources but STILL must pass qualifying number rules
const FAST_PUBLISH_DOMAINS = new Set<string>([
  "ghanabusinessnews.com",
  "ceditalk.com",
  "myjoyonline.com",
  "3news.com",
  "starrfm.com.gh",
  "ghanaweb.com",
  "citibusinessnews.com",
  "citinewsroom.com",
  "gna.org.gh",
  "peacefmonline.com",
  "adomonline.com",
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
  { name: "Ghana Business News", rss: "https://www.ghanabusinessnews.com/feed/", domain: "ghanabusinessnews.com" },
  { name: "Citi Newsroom", rss: "https://citinewsroom.com/feed/", domain: "citinewsroom.com" },
  { name: "CediTalk", rss: "https://www.ceditalk.com/feed/", domain: "ceditalk.com" },
  { name: "JoyBusiness", rss: "https://www.myjoyonline.com/business/feed/", domain: "myjoyonline.com" },
  { name: "MyJoyOnline News", rss: "https://www.myjoyonline.com/feed/", domain: "myjoyonline.com" },
  { name: "3News Ghana", rss: "https://3news.com/feed/", domain: "3news.com" },
  { name: "Starr FM Business", rss: "https://starrfm.com.gh/category/business/feed/", domain: "starrfm.com.gh" },
  { name: "Citi Business News", rss: "https://citibusinessnews.com/feed/", domain: "citibusinessnews.com" },
  { name: "Ghana News Agency", rss: "https://gna.org.gh/feed/", domain: "gna.org.gh" },
  { name: "Ghana News Agency Business", rss: "https://gna.org.gh/category/business/feed/", domain: "gna.org.gh" },
  { name: "GhanaWeb General", rss: "https://www.ghanaweb.com/GhanaHomePage/rss", domain: "ghanaweb.com" },
  { name: "Peace FM Online", rss: "https://www.peacefmonline.com/feed/", domain: "peacefmonline.com" },
  { name: "Adom Online", rss: "https://www.adomonline.com/feed/", domain: "adomonline.com" },
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
    articlePattern: /href="((?:https?:\/\/(?:www\.)?ghanaweb\.com)?\/GhanaHomePage\/features\/[^"]+\-\d+)"/gi,
    titlePattern: /<a[^>]+href="[^"]*\/features\/[^"]+\-\d+"[^>]*>([^<]+)<\/a>/gi,
    type: "opinion" as const,
  },
] as const;

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
  "warns", "slams", "blasts", "fires back", "claps back", "hits back",
  "attacks", "accuses", "alleges", "feud", "clash", "rift",
  "calls out", "calls for resignation", "must resign", "should resign",
  "responds to", "reacts to", "defends", "denies", "dismisses",
  "controversy", "controversial", "scandalous", "outrage", "outraged",
  "absence", "absent", "missing", "whereabouts", "disappeared",
  "rumour", "rumor", "rumoured", "rumored", "speculation", "speculates",
  "allegedly", "purported", "unconfirmed", "sources say", "insiders say",
  "spotted", "seen with", "relationship", "dating", "affair",
  "personal life", "private life", "family drama",
  "angry", "furious", "livid", "upset", "emotional", "heartbroken",
  "betrayed", "disappointed", "hurt feelings",
] as const;

// ============================================
// HEADLINE BLOCKLIST (Optimization #1: Pre-filter)
// Reject obviously non-business content before any fetch/AI call
// ============================================
const HEADLINE_BLOCKLIST = [
  // Entertainment & celebrity
  "nollywood", "big brother", "grammy", "oscars", "red carpet",
  "celebrity", "actress", "actor", "musician", "comedian", "rapper",
  "movie premiere", "film festival", "reality show", "talent show",
  "wedding photos", "baby bump", "divorce", "dating",
  // Sports (non-business)
  "goal scored", "penalty kick", "match preview", "full time score",
  "transfer window", "injury update", "squad list", "starting lineup",
  "premier league", "champions league", "la liga", "serie a",
  "relegation", "hat trick", "red card", "yellow card",
  // Religion & spirituality
  "prophecy", "prophetic", "pastor warns", "church service",
  "prayer warrior", "miracle healing", "deliverance", "anointing",
  "tithe", "crusade", "revival meeting",
  // Obituaries & funerals
  "funeral rites", "burial ceremony", "rest in peace", "rip",
  "condolence", "tribute to the late", "memorial service",
  "final funeral", "one week celebration", "40th day",
  // Lifestyle & gossip
  "fashion week", "slay queen", "best dressed", "outfit of the day",
  "recipe for", "cooking tips", "diet plan", "weight loss",
  "horoscope", "zodiac", "love life", "relationship advice",
  // Accidents & disasters (non-data)
  "accident on", "crash scene", "fire outbreak at",
  "drowning", "electrocuted", "collapsed building",
] as const;

function headlineIsBlocklisted(headline: string): { blocked: boolean; matchedTerm: string | null } {
  const lower = headline.toLowerCase();
  for (const term of HEADLINE_BLOCKLIST) {
    if (lower.includes(term)) {
      return { blocked: true, matchedTerm: term };
    }
  }
  return { blocked: false, matchedTerm: null };
}

// ============================================
// BATCH AI EDITORIAL FILTER (Optimization #2 + #3)
// Screen multiple headlines in one AI call using flash-lite
// ============================================
async function batchEditorialFilter(
  items: Array<{ title: string; description: string; source_name: string }>,
  lovableApiKey: string,
): Promise<Map<string, { pass: boolean; reason: string }>> {
  const results = new Map<string, { pass: boolean; reason: string }>();
  
  if (items.length === 0) return results;

  const numbered = items.map((item, i) => 
    `${i + 1}. [${item.source_name}] ${item.title}${item.description ? " — " + item.description.substring(0, 100) : ""}`
  ).join("\n");

  const prompt = `You are the editorial gatekeeper for StatsGH, a Ghana economic data news site.

Review each headline below. For EACH, respond with its number and either PASS or FAIL with a short reason.

PASS criteria (any one):
- Contains economic/financial data (GDP, inflation, budget, revenue, trade, etc.)
- Affects markets, currency, banking, taxation, jobs, or public finance
- Has clear business or investor impact
- Involves large monetary values (GHS, USD)
- Signals structural reform or economic risk

FAIL criteria:
- Crime stories without economic data
- Political rhetoric/gossip without policy data
- Entertainment, sports, celebrity news
- Ceremonial/social events
- Pure opinion without numbers
- Promotional PR

Headlines:
${numbered}

Respond in this exact format, one per line:
1: PASS
2: FAIL - political gossip
3: PASS
...`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      console.log(`Batch filter AI call failed (${resp.status}), defaulting all to PASS`);
      items.forEach(item => results.set(item.title, { pass: true, reason: "filter_unavailable" }));
      return results;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse response line by line
    const lines = content.split("\n").filter((l: string) => l.trim());
    for (const line of lines) {
      const match = line.match(/^(\d+)\s*:\s*(PASS|FAIL)(?:\s*[-–]\s*(.+))?/i);
      if (match) {
        const idx = parseInt(match[1]) - 1;
        if (idx >= 0 && idx < items.length) {
          const pass = match[2].toUpperCase() === "PASS";
          results.set(items[idx].title, { pass, reason: match[3]?.trim() || (pass ? "approved" : "rejected") });
        }
      }
    }

    // Default any missing to PASS (don't block if parsing fails)
    items.forEach(item => {
      if (!results.has(item.title)) {
        results.set(item.title, { pass: true, reason: "parse_default" });
      }
    });

  } catch (err) {
    console.log(`Batch filter error: ${err instanceof Error ? err.message : "Unknown"}`);
    items.forEach(item => results.set(item.title, { pass: true, reason: "error_default" }));
  }

  return results;
}

// ============================================
// SOURCE REJECTION CACHE (Optimization #5)
// Skip sources with very high recent rejection rates
// ============================================
const SOURCE_REJECTION_THRESHOLD = 0.95; // Skip if 95%+ rejected in last 24h
const SOURCE_MIN_SAMPLE = 10; // Need at least 10 candidates to evaluate

async function getHighRejectionSources(supabase: any): Promise<Set<string>> {
  const highRejectionSources = new Set<string>();
  
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get rejection stats per source from recent candidates
    const { data: candidates } = await supabase
      .from("newsroom_candidates")
      .select("source_name, decision")
      .gte("created_at", cutoff24h);
    
    if (!candidates || candidates.length === 0) return highRejectionSources;
    
    // Aggregate per source
    const stats = new Map<string, { total: number; rejected: number }>();
    for (const c of candidates) {
      const s = stats.get(c.source_name) || { total: 0, rejected: 0 };
      s.total++;
      if (c.decision === "rejected") s.rejected++;
      stats.set(c.source_name, s);
    }
    
    for (const [source, s] of stats) {
      if (s.total >= SOURCE_MIN_SAMPLE && (s.rejected / s.total) >= SOURCE_REJECTION_THRESHOLD) {
        console.log(`⚠ Source "${source}" has ${((s.rejected / s.total) * 100).toFixed(0)}% rejection rate (${s.rejected}/${s.total}) — temporarily skipped`);
        highRejectionSources.add(source);
      }
    }
  } catch (err) {
    console.log(`Rejection cache error: ${err}`);
  }
  
  return highRejectionSources;
}



// Statistical/analytical keywords that override crime exclusion
const CRIME_STATS_OVERRIDE_KEYWORDS = [
  "crime statistics", "crime rate", "crime data", "crime report",
  "annual crime", "crime trends", "crime reduction", "crime increased",
  "police statistics", "criminal justice reform", "crime prevention",
  "security statistics", "law enforcement data",
  "according to", "unicef", "world bank", "survey", "study", "research",
  "percent of", "% of", "percentage", "statistics show", "data shows",
  "report shows", "report indicates", "analysis", "trend",
  "child protection", "protection laws", "policy reform", "law reform",
  "legislative", "parliament", "regulation", "legal reform",
] as const;

// Data-driven indicators that make content acceptable for StatsGH
const DATA_SUBSTANCE_KEYWORDS = [
  "ghs", "ghc", "usd", "million", "billion", "trillion", "budget",
  "revenue", "expenditure", "deficit", "surplus", "gdp", "gnp",
  "percent", "%", "rate", "index", "ratio", "average", "median",
  "growth", "decline", "increase", "decrease", "rose", "fell",
  "statistics", "data", "figures", "numbers", "metrics",
  "inflation", "interest rate", "exchange rate", "unemployment",
  "trade balance", "import", "export", "investment", "fdi",
  "target", "projection", "forecast", "estimate", "quarter", "annual",
  "year-on-year", "month-on-month", "per capita", "per annum",
] as const;

// Default category if GPT returns an invalid slug format
const DEFAULT_CATEGORY = "macroeconomy";

// ============================================
// REJECTION CODES FOR AUDIT TRAIL (V2.0)
// ============================================
const REJECTION_CODES = {
  // Time window
  OUTSIDE_TIME_WINDOW: "OUTSIDE_TIME_WINDOW",
  PUBDATE_PARSE_FAILED: "PUBDATE_PARSE_FAILED",
  // Relevance
  NOT_BUSINESS: "NOT_BUSINESS",
  NOT_GHANA_RELEVANT: "NOT_GHANA_RELEVANT",
  // Content filters
  CRIME_FILTER: "CRIME_FILTER",
  CRIME_NO_SIGNIFICANT_DATA: "CRIME_NO_SIGNIFICANT_DATA",
  POLITICAL_GOSSIP: "POLITICAL_GOSSIP",
  POLITICS_NUMBER_NOT_DATA: "POLITICS_NUMBER_NOT_DATA",
  // Number quality (NEW)
  HEADLINE_NO_NUMBER: "HEADLINE_NO_NUMBER",
  HEADLINE_NUMBER_DATE_ONLY: "HEADLINE_NUMBER_DATE_ONLY",
  INSUFFICIENT_NUMBERS: "INSUFFICIENT_NUMBERS",
  INSUFFICIENT_QUALIFYING_NUMBERS: "INSUFFICIENT_QUALIFYING_NUMBERS",
  NO_NUMBERS_IN_RSS: "NO_NUMBERS_IN_RSS",
  NO_NUMBERS_IN_FULL_PAGE: "NO_NUMBERS_IN_FULL_PAGE",
  // Opinion specific
  DAILY_OPINION_LIMIT: "DAILY_OPINION_LIMIT",
  OPINION_NO_QUALIFYING_NUMBER: "OPINION_NO_QUALIFYING_NUMBER",
  // Deduplication
  DEDUPED_NEWSROOM: "DEDUPED_NEWSROOM",
  DEDUPED_ARTICLES: "DEDUPED_ARTICLES",
  DEDUPED_SEMANTIC: "DEDUPED_SEMANTIC",
  // AI validation
  AI_JSON_INVALID: "AI_JSON_INVALID",
  AI_REJECTED_NO_NUMBERS: "AI_REJECTED_NO_NUMBERS",
  AI_REJECTED_DATE_NUMBERS: "AI_REJECTED_DATE_NUMBERS",
  // Source quality
  IMAGE_FETCH_FAILED: "IMAGE_FETCH_FAILED",
  RSS_FETCH_FAILED: "RSS_FETCH_FAILED",
  FULL_PAGE_FETCH_FAILED: "FULL_PAGE_FETCH_FAILED",
  CALENDAR_ANNOUNCEMENT_PAGE: "CALENDAR_ANNOUNCEMENT_PAGE",
  // Daily limits
  DAILY_LIMIT_REACHED: "DAILY_LIMIT_REACHED",
} as const;

// ============================================
// QUALIFYING NUMBER CLASSIFICATION (V2.0)
// Not all numbers are equal - dates, times, IDs don't count
// ============================================

interface NumberClassification {
  value: string;
  isQualifying: boolean;
  reason: "CURRENCY" | "PERCENTAGE" | "QUANTITY" | "COMPARISON" | "DATE" | "TIME" | "ID" | "PHONE" | "ADDRESS" | "OTHER";
  context?: string;
}

// Patterns to detect DATE numbers (non-qualifying)
const DATE_PATTERNS = [
  /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/gi, // dd/mm/yyyy, dd-mm-yyyy
  /\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b/gi, // yyyy-mm-dd
  /\b\d{1,2}\s*(?:st|nd|rd|th)?\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{2,4}\b/gi,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{1,2}\s*(?:st|nd|rd|th)?\s*,?\s*\d{2,4}\b/gi,
  /\b\d{1,2}[-–]\d{1,2}\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, // 9-12 February
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{1,2}\s*,?\s*\d{2,4}\b/gi,
  /\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{2,4}\b/gi,
  /\b20\d{2}\b(?!\s*(?:%|percent|million|billion|ghs|usd|ghc|cedis|dollars))/gi, // Standalone year like "2026"
];

// Patterns to detect TIME numbers (non-qualifying)
const TIME_PATTERNS = [
  /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, // 10:44, 14:20, 2:30 pm
  /\b\d{1,2}\s*(?:am|pm)\b/gi, // 10am, 2pm
];

// Patterns to detect ID/Reference numbers (non-qualifying)
const ID_PATTERNS = [
  /\bPCN\s*[\d\-\/]+\b/gi,
  /\b(?:ref|reference|case)\s*(?:no|number|#)?\.?\s*:?\s*[\w\d\-\/]+\b/gi,
  /\bID\s*:?\s*[\w\d\-]+\b/gi,
  /\b[A-Z]{2,4}[-\/]?\d{4,}\b/g, // License plates, codes
];

// Patterns to detect phone numbers (non-qualifying)
const PHONE_PATTERNS = [
  /\b(?:\+233|0)\s*\d{2,3}[\s\-]?\d{3}[\s\-]?\d{4}\b/g, // Ghana phone numbers
  /\b\d{3}[\s\-]?\d{3}[\s\-]?\d{4}\b/g, // General phone pattern
];

// Keywords that indicate QUALIFYING numbers (currency/money context)
const CURRENCY_CONTEXT_KEYWORDS = [
  "ghs", "gh¢", "ghc", "cedi", "cedis", "pesewa", "usd", "$", "dollar", "dollars",
  "million", "billion", "trillion", "tranche", "bond", "yield", "grant", "loan",
  "revenue", "expenditure", "budget", "allocation", "funding", "investment",
];

// Keywords that indicate QUALIFYING numbers (percentage/rate context)
const PERCENTAGE_CONTEXT_KEYWORDS = [
  "%", "percent", "percentage", "percentage points", "bps", "basis points",
  "inflation", "interest", "growth", "rate", "y/y", "m/m", "yoy", "mom",
  "increase", "decrease", "rise", "fall", "drop", "surge", "decline",
];

// Keywords that indicate QUALIFYING numbers (quantity with economic/statistical unit)
const QUANTITY_CONTEXT_KEYWORDS = [
  "jobs", "employment", "workers", "employees", "staff",
  "tonnes", "metric tonnes", "tons", "barrels", "bbl",
  "mw", "megawatts", "kw", "kilowatts", "gwh", "kwh",
  "litres", "liters", "gallons",
  "subscribers", "users", "customers", "accounts",
  "exports", "imports", "production", "output",
  "revenue", "deficit", "debt", "reserves", "surplus",
  "gdp", "gnp", "capita", "population",
];

// Keywords that indicate COMPARISON/target context (qualifying)
const COMPARISON_CONTEXT_KEYWORDS = [
  "vs", "versus", "from", "to", "compared", "comparison",
  "target", "goal", "above", "below", "higher", "lower",
  "fell", "rose", "increased", "decreased", "cut", "expanded",
  "grew", "shrunk", "contracted", "gained", "lost",
  "previous", "last", "earlier", "former", "prior",
];

// Classify a number token
function classifyNumber(numberStr: string, contextBefore: string, contextAfter: string): NumberClassification {
  const fullContext = `${contextBefore} ${numberStr} ${contextAfter}`.toLowerCase();
  const numberLower = numberStr.toLowerCase();
  
  // Check if it's a date pattern
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(numberStr) || pattern.test(fullContext)) {
      return { value: numberStr, isQualifying: false, reason: "DATE" };
    }
  }
  
  // Check if it's a time pattern
  for (const pattern of TIME_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(numberStr)) {
      return { value: numberStr, isQualifying: false, reason: "TIME" };
    }
  }
  
  // Check if it's an ID/reference
  for (const pattern of ID_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(numberStr) || pattern.test(fullContext)) {
      return { value: numberStr, isQualifying: false, reason: "ID" };
    }
  }
  
  // Check if it's a phone number
  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(numberStr)) {
      return { value: numberStr, isQualifying: false, reason: "PHONE" };
    }
  }
  
  // Check for currency context
  if (CURRENCY_CONTEXT_KEYWORDS.some(kw => fullContext.includes(kw))) {
    return { value: numberStr, isQualifying: true, reason: "CURRENCY", context: "money/currency" };
  }
  
  // Check for percentage context
  if (PERCENTAGE_CONTEXT_KEYWORDS.some(kw => fullContext.includes(kw)) || numberStr.includes("%")) {
    return { value: numberStr, isQualifying: true, reason: "PERCENTAGE", context: "rate/percentage" };
  }
  
  // Check for quantity context
  if (QUANTITY_CONTEXT_KEYWORDS.some(kw => fullContext.includes(kw))) {
    return { value: numberStr, isQualifying: true, reason: "QUANTITY", context: "economic quantity" };
  }
  
  // Check for comparison context
  if (COMPARISON_CONTEXT_KEYWORDS.some(kw => fullContext.includes(kw))) {
    return { value: numberStr, isQualifying: true, reason: "COMPARISON", context: "comparison/change" };
  }
  
  // Default: non-qualifying unless it has economic indicators nearby
  return { value: numberStr, isQualifying: false, reason: "OTHER" };
}

// Extract and classify all numbers from text
function extractAndClassifyNumbers(text: string): {
  all: string[];
  qualifying: NumberClassification[];
  excluded: { value: string; reason: string }[];
} {
  const all: string[] = [];
  const qualifying: NumberClassification[] = [];
  const excluded: { value: string; reason: string }[] = [];
  
  // Find all number patterns with context
  const numberPattern = /(\S{0,30})\s*(\d[\d,\.]*(?:\s*(?:%|percent|million|billion|ghs|usd|ghc|tonnes?|mw|bbl|litres?))?)\s*(\S{0,30})/gi;
  
  let match;
  const seen = new Set<string>();
  
  while ((match = numberPattern.exec(text)) !== null) {
    const [, before, numStr, after] = match;
    const normalized = numStr.trim();
    
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    
    all.push(normalized);
    
    const classification = classifyNumber(normalized, before || "", after || "");
    
    if (classification.isQualifying) {
      qualifying.push(classification);
    } else {
      excluded.push({ value: normalized, reason: classification.reason });
    }
  }
  
  return { all, qualifying, excluded };
}

// Check if headline has a qualifying number (not just a date)
function headlineHasQualifyingNumber(headline: string): { hasQualifying: boolean; hasDateOnly: boolean; detail: string } {
  const { all, qualifying, excluded } = extractAndClassifyNumbers(headline);
  
  if (all.length === 0) {
    return { hasQualifying: false, hasDateOnly: false, detail: "No numbers found in headline" };
  }
  
  if (qualifying.length > 0) {
    return { 
      hasQualifying: true, 
      hasDateOnly: false, 
      detail: `Found qualifying: ${qualifying.map(q => `${q.value} (${q.reason})`).join(", ")}` 
    };
  }
  
  const dateNumbers = excluded.filter(e => e.reason === "DATE");
  if (dateNumbers.length > 0 && dateNumbers.length === excluded.length) {
    return { 
      hasQualifying: false, 
      hasDateOnly: true, 
      detail: `Only date numbers found: ${dateNumbers.map(d => d.value).join(", ")}` 
    };
  }
  
  return { 
    hasQualifying: false, 
    hasDateOnly: false, 
    detail: `Numbers excluded: ${excluded.map(e => `${e.value} (${e.reason})`).join(", ")}` 
  };
}

// Check if body meets qualifying number requirements
function bodyMeetsNumberRequirements(text: string): {
  passes: boolean;
  qualifyingCount: number;
  hasComparison: boolean;
  detail: string;
  numbersFoundAll: string[];
  numbersFoundQualifying: string[];
  excludedNumbers: { value: string; reason: string }[];
} {
  const { all, qualifying, excluded } = extractAndClassifyNumbers(text);
  
  const hasComparison = qualifying.some(q => q.reason === "COMPARISON");
  const qualifyingCount = qualifying.length;
  
  // V3.0: Relaxed — 1+ qualifying number anywhere in body is enough
  const passes = qualifyingCount >= 1;
  
  return {
    passes,
    qualifyingCount,
    hasComparison,
    detail: passes 
      ? `Passed: ${qualifyingCount} qualifying numbers${hasComparison ? " with comparison context" : ""}` 
      : `Failed: Only ${qualifyingCount} qualifying numbers${hasComparison ? "" : " and no comparison context"}`,
    numbersFoundAll: all,
    numbersFoundQualifying: qualifying.map(q => q.value),
    excludedNumbers: excluded,
  };
}

// Check if page is a calendar/announcement page (low value)
function isCalendarAnnouncementPage(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Count date patterns
  let dateCount = 0;
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) dateCount += matches.length;
  }
  
  // Count qualifying numbers
  const { qualifying } = extractAndClassifyNumbers(text);
  
  // If lots of dates but few qualifying numbers, it's likely a calendar page
  if (dateCount > 5 && qualifying.length < 2) {
    return true;
  }
  
  // Check for calendar/event keywords
  const calendarKeywords = [
    "event calendar", "upcoming events", "schedule", "agenda",
    "registration opens", "register now", "book your seat",
    "conference dates", "meeting schedule", "event listing",
  ];
  
  return calendarKeywords.filter(kw => lowerText.includes(kw)).length >= 2;
}

// ============================================
// GHANA RELEVANCE CHECK (V2.0) - SCORE-BASED
// Weights headline and first 150 words higher
// ============================================
const GHANA_RELEVANCE_KEYWORDS = [
  // Country/Region
  "ghana", "ghanaian", "accra", "kumasi", "tamale", "takoradi", "tema", "cape coast",
  "ashanti", "volta", "eastern region", "western region", "northern region", "greater accra",
  "brong ahafo", "upper east", "upper west", "central region", "oti region", "savannah",
  "bono east", "ahafo", "north east", "western north",
  // Institutions (original)
  "bog", "bank of ghana", "gse", "ghana stock exchange", "gra", "ghana revenue",
  "cocobod", "gnpc", "vra", "ecg", "gpha", "ghacem", "goil", "tullow ghana",
  "mtn ghana", "vodafone ghana", "airtel-tigo", "airteltigo", "stanbic ghana",
  "gcb", "ecobank ghana", "fidelity bank", "calbank", "unibank", "databank",
  // NEW: Ghana-specific entities for data stories
  "ministry of finance", "finance ministry", "mof ghana",
  "imf", "world bank", "afdb", "african development bank",
  "cocobod", "goldbod",
  "tema port", "takoradi port",
  "purc", "npa", "national petroleum authority",
  "ssnit", "nhia", "national health insurance",
  "cagd", "controller and accountant general",
  // Currency
  "cedi", "cedis", "ghc", "ghs",
  // Government
  "parliament of ghana", "ndc", "npp", "akufo-addo", "bawumia", "mahama",
  "finance minister", "ministry of finance", "ofori-atta", "ken ofori",
  // Sports/Entertainment (if relevant)
  "black stars", "kotoko", "hearts of oak",
] as const;

// Score-based Ghana relevance check
function getGhanaRelevanceScore(headline: string, bodyText: string): { score: number; passes: boolean; detail: string } {
  const headlineLower = headline.toLowerCase();
  const first150Words = bodyText.split(/\s+/).slice(0, 150).join(" ").toLowerCase();
  const fullLower = bodyText.toLowerCase();
  
  let score = 0;
  const matches: string[] = [];
  
  for (const keyword of GHANA_RELEVANCE_KEYWORDS) {
    // Headline match: 3 points
    if (headlineLower.includes(keyword)) {
      score += 3;
      matches.push(`headline:${keyword}`);
    }
    // First 150 words match: 2 points
    else if (first150Words.includes(keyword)) {
      score += 2;
      matches.push(`opening:${keyword}`);
    }
    // Body match: 1 point
    else if (fullLower.includes(keyword)) {
      score += 1;
      matches.push(`body:${keyword}`);
    }
  }
  
  // V3.0: Relaxed threshold — 1 point is enough (any single mention of Ghana entity)
  const passes = score >= 1;
  
  return {
    score,
    passes,
    detail: passes 
      ? `Ghana relevance passed (score ${score}): ${matches.slice(0, 5).join(", ")}` 
      : `Ghana relevance failed (score ${score}): Not enough Ghana context in headline/opening`
  };
}

// ============================================
// CRIME FILTER V2.0 - Significant data required
// ============================================
function isCrimeNewsWithData(text: string): { isCrime: boolean; hasSignificantData: boolean; detail: string } {
  const lowerText = text.toLowerCase();
  
  // First check if it's crime content
  const isCrime = CRIME_EXCLUSION_KEYWORDS.some(keyword => lowerText.includes(keyword));
  if (!isCrime) {
    return { isCrime: false, hasSignificantData: false, detail: "Not crime content" };
  }
  
  // Check for statistical override keywords
  const hasStatsOverride = CRIME_STATS_OVERRIDE_KEYWORDS.some(keyword => lowerText.includes(keyword));
  
  // Check for qualifying numbers
  const { qualifying } = extractAndClassifyNumbers(text);
  const hasQualifyingNumbers = qualifying.length >= 2;
  
  // Check for GHS amount or percentage
  const hasMoneyOrPercent = qualifying.some(q => q.reason === "CURRENCY" || q.reason === "PERCENTAGE");
  
  // Check for official source reference
  const hasOfficialSource = /\b(according to|ministry|police statistics|crime report|survey|study|research|unicef|world bank)\b/i.test(text);
  
  // V3.0: Softened — any GHS amount, percentage, or 1+ qualifying number passes
  const hasSignificantData = hasMoneyOrPercent || hasQualifyingNumbers || hasOfficialSource || hasStatsOverride;
  
  return {
    isCrime: true,
    hasSignificantData,
    detail: hasSignificantData 
      ? `Crime content with significant data: ${qualifying.length} qualifying numbers, ${hasMoneyOrPercent ? "has money/percent" : ""} ${hasOfficialSource ? "has official source" : ""}`
      : `Crime content without significant data: only ${qualifying.length} qualifying numbers, no money/percent/official source`
  };
}

// ============================================
// POLITICS FILTER V2.0 - Numbers must be policy data
// ============================================
function isPoliticsWithoutData(text: string): { isPolitics: boolean; numbersAreData: boolean; detail: string } {
  const lowerText = text.toLowerCase();
  
  // Check for political gossip keywords
  const isPolitics = POLITICAL_GOSSIP_EXCLUSION_KEYWORDS.some(keyword => lowerText.includes(keyword));
  if (!isPolitics) {
    return { isPolitics: false, numbersAreData: true, detail: "Not political gossip content" };
  }
  
  // Check for data substance keywords
  const hasDataSubstance = DATA_SUBSTANCE_KEYWORDS.some(keyword => lowerText.includes(keyword));
  
  // Check qualifying numbers
  const { qualifying, excluded } = extractAndClassifyNumbers(text);
  
  // Vote counts without policy impact are not data
  const votePattern = /\b(votes?|voting|ballot|win|won|lost|seats?)\b/i;
  const hasOnlyVoteNumbers = qualifying.length > 0 && 
    !qualifying.some(q => q.reason === "CURRENCY" || q.reason === "PERCENTAGE") &&
    votePattern.test(text);
  
  // Policy impact keywords
  const hasPolicyImpact = /\b(budget|allocation|revenue|expenditure|gdp|inflation|deficit|surplus|policy|reform)\b/i.test(text);
  
  const numbersAreData = hasDataSubstance && (hasPolicyImpact || !hasOnlyVoteNumbers);
  
  return {
    isPolitics: true,
    numbersAreData,
    detail: numbersAreData 
      ? `Political content with policy data: ${qualifying.length} qualifying numbers with data substance`
      : `Political content without policy data: ${hasOnlyVoteNumbers ? "only vote counts" : "no data substance keywords"}`
  };
}

// Helper to ensure category exists in database, creates if not
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
  'tv-studio', 'news-desk', 'breaking-news-graphic'
];

function isCompetitorImage(imageUrl: string): boolean {
  const lowerUrl = imageUrl.toLowerCase();
  
  if (COMPETITOR_IMAGE_DOMAINS.some(domain => lowerUrl.includes(domain))) {
    console.log(`⚠ Skipping competitor image from: ${imageUrl.substring(0, 100)}...`);
    return true;
  }
  
  if (BRANDED_IMAGE_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
    console.log(`⚠ Skipping branded image pattern in: ${imageUrl.substring(0, 100)}...`);
    return true;
  }
  
  return false;
}

async function extractImageFromSourceHtml(html: string, sourceUrl: string): Promise<string | null> {
  try {
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      /"image"\s*:\s*"([^"]+)"/i,
      /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
      /<img[^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image)[^"']*["'][^>]+src=["']([^"']+)["']/i,
      /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:featured|hero|main|article-image|post-image|entry-image)[^"']*["']/i,
      /<img[^>]+data-src=["']([^"']+)["'][^>]+width=["']([4-9]\d{2}|[1-9]\d{3})["']/i,
      /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
    ];
    
    let imageUrl: string | null = null;
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const url = match[1] || match[2];
        if (url && (url.startsWith('http') || url.startsWith('//'))) {
          imageUrl = url;
          break;
        }
      }
    }
    
    if (!imageUrl) return null;
    
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }
    
    if (imageUrl.startsWith('/')) {
      try {
        const urlObj = new URL(sourceUrl);
        imageUrl = `${urlObj.origin}${imageUrl}`;
      } catch {
        return null;
      }
    }
    
    if (isCompetitorImage(imageUrl)) {
      return null;
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const isImageUrl = imageExtensions.some(ext => 
      imageUrl!.toLowerCase().includes(ext)
    ) || imageUrl.includes('/image') || imageUrl.includes('img');
    
    if (!isImageUrl) return null;
    
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

// Build dedupe key using QUALIFYING numbers only
function buildDedupeKey(eventCore: string, org: string, dateStr: string, qualifyingNumbers: string[]): string {
  // Use top 3 qualifying numbers only
  const topNumbers = qualifyingNumbers.slice(0, 3);
  
  // If fewer than 3, use: first qualifying number + key metric phrase + org
  if (topNumbers.length < 3 && topNumbers.length > 0) {
    const parts = [eventCore.substring(0, 50), org, topNumbers[0]];
    const combined = parts.join(" ");
    return combined
      .toLowerCase()
      .replace(/[^a-z0-9%\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  const parts = [eventCore, org, dateStr, ...topNumbers];
  const combined = parts.join(" ");
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Multi-signal semantic deduplication ──────────────────────────────────────

const STOP_WORDS = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","shall","should","may","might","must","can","could",
  "to","of","in","for","on","with","at","by","from","as","into","through","during","before",
  "after","above","below","between","out","off","over","under","again","further","then","once",
  "and","but","or","nor","not","so","yet","both","either","neither","each","every","all","any",
  "few","more","most","other","some","such","no","only","own","same","than","too","very",
  "it","its","this","that","these","those","he","she","they","we","you","i","me","him","her",
  "us","them","my","your","his","our","their","what","which","who","whom","where","when","how",
  "new","says","said","also","over","about","up","percent","ghs"]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function extractKeywords(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Extract bigrams (consecutive word pairs) for phrase-level matching */
function extractBigrams(text: string): Set<string> {
  const words = tokenize(text);
  const bigrams = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]}|${words[i + 1]}`);
  }
  return bigrams;
}

/** Extract named entities: acronyms (AGI, IMF), proper nouns, org-like tokens */
function extractEntities(text: string): Set<string> {
  const entities = new Set<string>();
  // Match acronyms (2+ uppercase letters)
  const acronyms = text.match(/\b[A-Z]{2,}\b/g);
  if (acronyms) acronyms.forEach(a => entities.add(a.toLowerCase()));
  // Match capitalized multi-word names (e.g. "Bank of Ghana", "Cocoa Board")
  const properNouns = text.match(/[A-Z][a-z]+(?:\s+(?:of|and|the|for)\s+[A-Z][a-z]+|\s+[A-Z][a-z]+)*/g);
  if (properNouns) properNouns.forEach(p => entities.add(p.toLowerCase()));
  // Match standalone capitalized words that aren't sentence starters (rough heuristic)
  const caps = text.match(/(?<=[.!?]\s+|^)[A-Z][a-z]+|(?<=\s)[A-Z][a-z]{2,}/g);
  if (caps) caps.forEach(c => { if (c.length > 3) entities.add(c.toLowerCase()); });
  return entities;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Composite similarity score combining multiple signals:
 *  - Unigram Jaccard (word overlap)        weight: 0.30
 *  - Bigram Jaccard (phrase overlap)       weight: 0.35
 *  - Entity overlap (orgs, acronyms)       weight: 0.35
 *
 * Returns { score, breakdown } where score is 0-1.
 */
function compositeSimilarity(
  textA: string, textB: string
): { score: number; breakdown: { unigram: number; bigram: number; entity: number } } {
  const unigramScore = jaccardSimilarity(extractKeywords(textA), extractKeywords(textB));
  const bigramScore = jaccardSimilarity(extractBigrams(textA), extractBigrams(textB));
  const entityScore = jaccardSimilarity(extractEntities(textA), extractEntities(textB));

  // Weighted composite
  const score = unigramScore * 0.30 + bigramScore * 0.35 + entityScore * 0.35;
  return { score, breakdown: { unigram: unigramScore, bigram: bigramScore, entity: entityScore } };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isBusinessRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BUSINESS_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

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

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : "";
    
    const linkMatch = itemContent.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const link = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : "";
    
    const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
    
    const descMatch = itemContent.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    let description = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : "";
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
    
    const isGhanaWeb = url.includes('ghanaweb.com');
    let text = '';
    
    if (isGhanaWeb) {
      const articleContentMatch = html.match(/<div[^>]+class="[^"]*(?:article-content|feature-body|entry-content|post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      
      if (articleContentMatch) {
        text = articleContentMatch[1];
      } else {
        const mainMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (mainMatch) {
          text = mainMatch[1];
        } else {
          text = html;
        }
      }
    } else {
      text = html;
    }
    
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ')
      .replace(/<div[^>]*class="[^"]*(?:login|signup|subscribe|newsletter|terms|cookie|consent|modal|popup|overlay|sidebar|advertisement|ad-|banner)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/Terms of Service[\s\S]{0,200}Privacy Policy/gi, ' ')
      .replace(/Log\s*in[\s\S]{0,100}Sign\s*up/gi, ' ')
      .replace(/Cookie[\s\S]{0,100}preferences/gi, ' ')
      .replace(/Subscribe to our newsletter/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 5000);
  } catch (error) {
    console.log(`Full page fetch error for ${url}:`, error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

// ============================================
// GHANAWEB HTML SCRAPER
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
    
    const articleMatches: Array<{ url: string; title: string }> = [];
    
    const titleAttrPattern = /<a[^>]+href="(https?:\/\/(?:www\.)?ghanaweb\.com\/GhanaHomePage\/business\/[^"]+\-\d+)"[^>]+title="([^"]+)"/gi;
    let match;
    
    while ((match = titleAttrPattern.exec(html)) !== null) {
      const url = match[1];
      let title = match[2].trim();
      
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
    
    const headingPattern = /<a[^>]+href="(https?:\/\/(?:www\.)?ghanaweb\.com\/GhanaHomePage\/business\/[^"]+\-\d+)"[^>]*>[\s\S]*?<h[23][^>]*>([^<]+)<\/h[23]>/gi;
    
    while ((match = headingPattern.exec(html)) !== null) {
      const url = match[1];
      let title = match[2].trim();
      
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
    
    const seenUrls = new Set<string>();
    const uniqueArticles = articleMatches.filter(a => {
      if (seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });
    
    console.log(`GhanaWeb: Found ${uniqueArticles.length} unique article links`);
    
    const articlesToProcess = uniqueArticles.slice(0, 15);
    
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
// Opinion articles: max 1 per 24h, must have 1 qualifying number
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
    
    const articleMatches: Array<{ url: string; title: string }> = [];
    
    const featureLinkPattern = /<a[^>]+href="((?:https?:\/\/(?:www\.)?ghanaweb\.com)?\/GhanaHomePage\/features\/([^"]+\-\d+))"[^>]*>/gi;
    let match;
    
    while ((match = featureLinkPattern.exec(html)) !== null) {
      let url = match[1];
      const slug = match[2];
      
      if (url.startsWith('/')) {
        url = `https://www.ghanaweb.com${url}`;
      }
      
      let title = slug.replace(/\-\d+$/, '').replace(/-/g, ' ').trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      if (title.length < 15) continue;
      
      articleMatches.push({ url, title });
    }
    
    console.log(`GhanaWeb Opinions: Found ${articleMatches.length} article matches before dedup`);
    
    const seenUrls = new Set<string>();
    const uniqueArticles = articleMatches.filter(a => {
      if (seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });
    
    console.log(`GhanaWeb Opinions: Found ${uniqueArticles.length} unique article links`);
    
    // Limit to 5 for opinions (will be further limited by daily cap)
    const articlesToProcess = uniqueArticles.slice(0, 5);
    
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

// Log candidate to audit table with enhanced number logging
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
    numbersFoundQualifying?: string[];
    excludedNumbers?: { value: string; reason: string }[];
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
        dedupe_similarity_evidence: extras.dedupeSimilarityEvidence || 
          (extras.excludedNumbers ? { excluded_numbers: extras.excludedNumbers } : null),
        numbers_found: extras.numbersFound || extras.numbersFoundQualifying || null,
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
    
    // V2.0: Default 5 hours, backfill 7 days
    const timeWindowHours = isBackfill 
      ? Number(body.timeWindowHours ?? body.time_window_hours ?? BACKFILL_TIME_WINDOW_HOURS)
      : Number(body.timeWindowHours ?? body.time_window_hours ?? DEFAULT_TIME_WINDOW_HOURS);
    
    const targetSource = body.targetSource ?? body.target_source ?? null;

    // ============================================
    // LOAD SOURCES FROM DATABASE WITH PRIORITY ROTATION
    // ============================================
    const { data: dbSources } = await supabase
      .from("newsroom_sources")
      .select("name, rss_url, priority_tier, last_success_at, is_active")
      .eq("is_active", true)
      .order("last_success_at", { ascending: true, nullsFirst: true });

    const activeDbSources = dbSources || [];
    console.log(`Loaded ${activeDbSources.length} active sources from database`);

    // Priority rotation: Tier 1-2 every run, Tier 3-6 every 2nd run, Tier 7-10 every 3rd run
    const runCount = Date.now(); // Use timestamp as pseudo run counter
    const runMod = Math.floor(runCount / (60 * 60 * 1000)) % 3; // changes every hour, cycles 0-1-2
    
    const sourcesThisRun = activeDbSources.filter((s: any) => {
      const tier = s.priority_tier || 5;
      if (tier <= 2) return true; // always
      if (tier <= 6) return runMod % 2 === 0; // every 2nd run
      return runMod === 0; // every 3rd run
    });

    // Cap at 50 sources per run
    const MAX_SOURCES_PER_RUN = 50;
    const cappedSources = sourcesThisRun.slice(0, MAX_SOURCES_PER_RUN);
    console.log(`Sources this run: ${cappedSources.length} (tier filter from ${activeDbSources.length} active, cap ${MAX_SOURCES_PER_RUN})`);

    // Build domain lookup from DB sources
    const sourceNameToDomain = new Map<string, string>();
    for (const s of cappedSources) {
      try {
        const domain = new URL(s.rss_url).hostname.replace(/^www\./, "");
        sourceNameToDomain.set(s.name, domain);
      } catch { /* skip invalid URLs */ }
    }
    sourceNameToDomain.set("GhanaWeb Business", "ghanaweb.com");
    sourceNameToDomain.set("GhanaWeb Opinions", "ghanaweb.com");

    // Track which sources are international (tier 9) for Ghana relevance filtering
    const internationalSources = new Set<string>();
    for (const s of cappedSources) {
      if ((s.priority_tier || 5) >= 9) internationalSources.add(s.name);
    }

    const isFastPublishSource = (sourceName: string): boolean => {
      const domain = sourceNameToDomain.get(sourceName);
      return domain ? FAST_PUBLISH_DOMAINS.has(domain) : false;
    };

    // Auto-pass: Citi Business News and Joy Business bypass ALL editorial filters
    const isAutoPassSource = (sourceName: string): boolean => {
      const domain = sourceNameToDomain.get(sourceName);
      return domain ? AUTO_PASS_DOMAINS.has(domain) : false;
    };

    const isOpinionSource = (sourceName: string): boolean => {
      return sourceName === "GhanaWeb Opinions";
    };

    // ============================================
    // CHECK DAILY PUBLISH LIMIT
    // ============================================
    const twentyFourHoursAgo = new Date(nowUtc().getTime() - 24 * 60 * 60 * 1000);
    const { count: articlesLast24h } = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo.toISOString());
    
    const currentDailyCount = articlesLast24h ?? 0;
    console.log(`Articles published in last 24h: ${currentDailyCount}/${DAILY_PUBLISH_LIMIT}`);
    
    if (currentDailyCount >= DAILY_PUBLISH_LIMIT) {
      return new Response(JSON.stringify({
        success: false,
        error: `Daily publish limit reached (${DAILY_PUBLISH_LIMIT} articles per 24h)`,
        articles_today: currentDailyCount,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // PHASE 0: PICK UP PENDING_AI ARTICLES FROM PREVIOUS RUNS
    // These are overflow articles that couldn't be processed due to CPU limits
    // ============================================
    const { data: pendingAiArticles } = await supabase
      .from("newsroom_articles")
      .select("*")
      .eq("processing_status", "pending_ai")
      .order("created_at", { ascending: true })
      .limit(AI_BATCH_SIZE);

    if (pendingAiArticles && pendingAiArticles.length > 0) {
      console.log(`Found ${pendingAiArticles.length} pending_ai articles from previous runs — processing first`);
    }

    // ============================================
    // REPROCESS PENDING MODE (unchanged from original)
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
      
      // Actually reprocess: reset status and let them be picked up
      let reprocessed = 0;
      for (const item of pendingItems) {
        await supabase.from("newsroom_articles").update({
          processing_status: "pending",
          error_message: null,
        }).eq("id", item.id);
        reprocessed++;
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: `Reset ${reprocessed} articles to pending for reprocessing`,
        articles_reprocessed: reprocessed,
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
      is_opinion?: boolean;
    }> = [];

    const sourcesToFetch = isBackfill
      ? cappedSources.filter((s: any) => {
          const domain = sourceNameToDomain.get(s.name) || "";
          const isFast = FAST_PUBLISH_DOMAINS.has(domain);
          const matchesTarget = !targetSource || s.name.toLowerCase().includes(targetSource.toLowerCase()) || domain.includes(targetSource.toLowerCase());
          return isFast && matchesTarget;
        })
      : cappedSources;

    const feedPromises = sourcesToFetch.map(async (source: any) => {
      console.log(`Fetching RSS from ${source.name}: ${source.rss_url}`);
      const xml = await fetchRssFeed(source.rss_url);
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
    // FETCH GHANAWEB VIA HTML SCRAPING
    // ============================================
    const shouldScrapeGhanaWeb = !targetSource || 
      targetSource.toLowerCase().includes("ghanaweb") || 
      targetSource.toLowerCase().includes("ghana web");
    
    if (shouldScrapeGhanaWeb) {
      console.log("Scraping GhanaWeb Business page...");
      const ghanaWebArticles = await scrapeGhanaWebBusiness();
      allArticles.push(...ghanaWebArticles);
      
      if (ghanaWebArticles.length > 0) {
        await updateSourceHealth(supabase, "GhanaWeb Business", true, ghanaWebArticles.length);
      } else {
        await updateSourceHealth(supabase, "GhanaWeb Business", false, 0, "HTML scrape returned no articles");
      }

      console.log("Scraping GhanaWeb Opinions page...");
      const ghanaWebOpinions = await scrapeGhanaWebOpinions();
      allArticles.push(...ghanaWebOpinions);
      
      if (ghanaWebOpinions.length > 0) {
        await updateSourceHealth(supabase, "GhanaWeb Opinions", true, ghanaWebOpinions.length);
      } else {
        await updateSourceHealth(supabase, "GhanaWeb Opinions", false, 0, "HTML scrape returned no articles");
      }
    }

    console.log(`Total items after scraping: ${allArticles.length}`);

    // ============================================
    // PROCESS EACH ARTICLE WITH V2.0 QUALIFYING NUMBER RULES
    // ============================================
    const qualifyingArticles: Array<{
      title: string;
      link: string;
      pubDate: string;
      description: string;
      source_name: string;
      _pubDateParsed: Date;
      _fullText: string;
      _numbersFoundAll: string[];
      _numbersFoundQualifying: string[];
      _excludedNumbers: { value: string; reason: string }[];
      _dedupeKey: string;
      _dedupeKeyRaw: string;
      _isOpinion?: boolean;
    }> = [];

    const perSourceCounts = new Map<string, number>();

    // No opinion daily limit
    const DAILY_OPINION_LIMIT = 999;
    const { count: opinionCountLast24h } = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("category_slug", "opinion")
      .gte("created_at", twentyFourHoursAgo.toISOString());
    
    const currentOpinionCount = opinionCountLast24h ?? 0;
    let opinionsCreatedThisRun = 0;
    console.log(`Opinion articles in last 24h: ${currentOpinionCount}/${DAILY_OPINION_LIMIT}`);

    let articlesCreatedThisRun = 0;
    // In-memory set of accepted titles this run to prevent within-run duplicates
    const acceptedTitlesThisRun: string[] = [];

    // Optimization #5: Load high-rejection sources to skip
    const highRejectionSources = await getHighRejectionSources(supabase);
    let preFilterBlockedCount = 0;
    let sourceSkippedCount = 0;

    for (const article of allArticles) {
      const isFast = isFastPublishSource(article.source_name);
      const isAutoPass = isAutoPassSource(article.source_name);
      const isOpinion = isOpinionSource(article.source_name) || article.is_opinion === true;
      if (isBackfill && !isFast && !isOpinion) continue;

      // Optimization #5: Skip high-rejection sources (but not auto-pass)
      if (!isAutoPass && highRejectionSources.has(article.source_name)) {
        sourceSkippedCount++;
        continue;
      }

      // Optimization #1: Fast headline blocklist (no AI needed)
      if (!isAutoPass) {
        const blockCheck = headlineIsBlocklisted(article.title);
        if (blockCheck.blocked) {
          preFilterBlockedCount++;
          await logCandidate(supabase, run.id, article, "rejected", "PRE_FILTER_BLOCKED",
            `Headline matched blocklist term: "${blockCheck.matchedTerm}"`, {});
          continue;
        }
      }

      // Ghana relevance filter for international sources (tier 9+)
      if (internationalSources.has(article.source_name)) {
        const ghanaTerms = /\b(ghana|ghanaian|accra|ghs|cedi|gse|bog|bank\s+of\s+ghana|cocobod|gra|mof|gipc)\b/i;
        const textToCheck = `${article.title} ${article.description || ""}`;
        if (!ghanaTerms.test(textToCheck)) {
          await logCandidate(supabase, run.id, article, "rejected", "NO_GHANA_RELEVANCE",
            `International source with no Ghana mention`, {});
          continue;
        }
      }

      // Check daily limit
      if ((currentDailyCount + articlesCreatedThisRun) >= DAILY_PUBLISH_LIMIT) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.DAILY_LIMIT_REACHED,
          `Daily publish limit reached (${DAILY_PUBLISH_LIMIT} per 24h)`, { pubDateParsed: null });
        continue;
      }

      // Check daily opinion limit (now 1, not 3)
      if (isOpinion && (currentOpinionCount + opinionsCreatedThisRun) >= DAILY_OPINION_LIMIT) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.DAILY_OPINION_LIMIT,
          `Daily opinion limit reached (${DAILY_OPINION_LIMIT} per 24h)`, { pubDateParsed: null });
        continue;
      }

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

      if (!pubDate) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.PUBDATE_PARSE_FAILED, 
          `Could not parse date: ${article.pubDate}`, { pubDateParsed: null });
        continue;
      }

      // Check time window
      if (pubDate < cutoffTime) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.OUTSIDE_TIME_WINDOW,
          `Published ${Math.round((nowUtc().getTime() - pubDate.getTime()) / (1000 * 60 * 60))}h ago, cutoff is ${timeWindowHours}h`,
          { pubDateParsed: pubDate });
        continue;
      }

      // Check if business-related (still skip for fast-publish; auto-pass sources bypass this)
      const rssText = `${article.title} ${article.description}`;
      if (!isAutoPass && !isFast && !isOpinion && !isBusinessRelated(rssText)) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.NOT_BUSINESS,
          "No business keywords found in headline/summary", { pubDateParsed: pubDate });
        continue;
      }

      // V2.0: Score-based Ghana relevance check (auto-pass sources skip this)
      if (!isAutoPass) {
        const ghanaCheck = getGhanaRelevanceScore(article.title, rssText);
        if (!ghanaCheck.passes) {
          await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.NOT_GHANA_RELEVANT,
            ghanaCheck.detail, { pubDateParsed: pubDate });
          continue;
        }
      }

    // V3.0: Headline number requirement REMOVED — numbers in body are sufficient
      // Previously rejected articles without numbers in headline (HEADLINE_NO_NUMBER)
      // Now we only check body-level number quality after fetching full text

      // Fetch full text for content analysis (only for articles that passed headline check)
      let fullText = rssText;
      let fullPageHtml: string | null = null;
      
      console.log(`Fetching full page for: ${article.link}`);
      const pageText = await fetchFullPageText(article.link);
      
      if (pageText) {
        fullText = `${rssText} ${pageText}`;
        fullPageHtml = pageText;
      }

      // Auto-pass sources skip all content filters below — proceed directly to dedupe + publish
      if (!isAutoPass) {
        // V2.0: Check for calendar/announcement page
        if (isCalendarAnnouncementPage(fullText)) {
          await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.CALENDAR_ANNOUNCEMENT_PAGE,
            "Page appears to be a calendar/announcement listing with many dates but few data points", 
            { pubDateParsed: pubDate, fullText: fullText.substring(0, 500) });
          continue;
        }

        // V2.0: Crime filter with significant data requirement
        const crimeCheck = isCrimeNewsWithData(fullText);
        if (crimeCheck.isCrime && !crimeCheck.hasSignificantData) {
          await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.CRIME_NO_SIGNIFICANT_DATA,
            crimeCheck.detail, { pubDateParsed: pubDate });
          continue;
        }

        // V2.0: Politics filter - numbers must be policy data
        const politicsCheck = isPoliticsWithoutData(fullText);
        if (politicsCheck.isPolitics && !politicsCheck.numbersAreData) {
          await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.POLITICS_NUMBER_NOT_DATA,
            politicsCheck.detail, { pubDateParsed: pubDate });
          continue;
        }
      }

      // V2.0: Extract and classify numbers
      const numberAnalysis = bodyMeetsNumberRequirements(fullText);
      
      // V2.1: Headline check already done before page fetch (moved up for optimization)
      
      // V6.0: Numbers are a scoring signal, not a gate — log but don't reject
      if (!isAutoPass && !numberAnalysis.passes) {
        console.log(`⚠ Low numeric content: "${article.title.substring(0, 60)}..." — ${numberAnalysis.detail} (proceeding anyway)`);
      }

      // V2.0: Generate dedupe key using QUALIFYING numbers only
      const dateStr = pubDate.toISOString().split("T")[0];
      const dedupeKeyRaw = buildDedupeKey(article.title, article.source_name, dateStr, numberAnalysis.numbersFoundQualifying);
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
            },
            numbersFound: numberAnalysis.numbersFoundAll,
            numbersFoundQualifying: numberAnalysis.numbersFoundQualifying,
          });
        continue;
      }

      // Check for duplicates in published articles
      const { data: seenArticles } = await supabase
        .from("articles")
        .select("id, title")
        .eq("dedupe_key", dedupeKeyHash)
        .limit(1);

      if (seenArticles && seenArticles.length > 0) {
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.DEDUPED_ARTICLES,
          `Matched existing published article`, {
            pubDateParsed: pubDate,
            dedupeKey: dedupeKeyHash,
            dedupeMatchedArticleId: seenArticles[0].id,
            dedupeSimilarityEvidence: { 
              matched_title: seenArticles[0].title,
            },
            numbersFound: numberAnalysis.numbersFoundAll,
            numbersFoundQualifying: numberAnalysis.numbersFoundQualifying,
          });
        continue;
      }

      // V6.0: Two-tier deduplication — relaxed
      // Tier 1: Fast title-keyword overlap (5+ shared content words in title = immediate reject)
      // Tier 2: Composite semantic similarity on title+summary (90% threshold)
      const KEYWORD_OVERLAP_MIN = 5; // 5+ shared title keywords = same story
      const SEMANTIC_THRESHOLD = 0.90; // composite threshold for title+summary (was 0.25)
      const cutoff48h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12h lookback (was 48h)
      const candidateText = [article.title, article.summary || ""].join(" ");
      const candidateTitleKeywords = extractKeywords(article.title);
      
      // Fetch ALL recent articles (including drafts from pipeline)
      const { data: recentArticles } = await supabase
        .from("articles")
        .select("id, title, summary")
        .gte("created_at", cutoff48h)
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch recent newsroom articles
      const { data: recentNewsroom } = await supabase
        .from("newsroom_articles")
        .select("id, original_headline, original_summary")
        .gte("created_at", cutoff48h)
        .order("created_at", { ascending: false })
        .limit(80);

      // Build combined comparison list
      const comparisons: Array<{ id: string; title: string; text: string }> = [];
      if (recentArticles) {
        for (const ra of recentArticles) {
          comparisons.push({ id: ra.id, title: ra.title, text: [ra.title, (ra as any).summary || ""].join(" ") });
        }
      }
      if (recentNewsroom) {
        for (const rn of recentNewsroom) {
          comparisons.push({ id: rn.id, title: rn.original_headline, text: [rn.original_headline, (rn as any).original_summary || ""].join(" ") });
        }
      }

      // Also compare against titles accepted earlier in THIS run (not yet in DB)
      for (const prevTitle of acceptedTitlesThisRun) {
        comparisons.push({ id: "in-run", title: prevTitle, text: prevTitle });
      }

      let semanticMatch: { id: string; title: string; score: number; breakdown: any; method: string } | null = null;

      for (const comp of comparisons) {
        // TIER 1: Title keyword overlap – if 3+ content words match, it's the same story
        const compTitleKeywords = extractKeywords(comp.title);
        let sharedCount = 0;
        const sharedWords: string[] = [];
        for (const w of candidateTitleKeywords) {
          if (compTitleKeywords.has(w)) {
            sharedCount++;
            sharedWords.push(w);
          }
        }
        if (sharedCount >= KEYWORD_OVERLAP_MIN) {
          semanticMatch = {
            id: comp.id,
            title: comp.title,
            score: sharedCount / Math.min(candidateTitleKeywords.size, compTitleKeywords.size),
            breakdown: { method: "title_keyword_overlap", shared_words: sharedWords, shared_count: sharedCount },
            method: "keyword",
          };
          break;
        }

        // TIER 2: Full composite similarity on title+summary
        const { score, breakdown } = compositeSimilarity(candidateText, comp.text);
        if (score >= SEMANTIC_THRESHOLD) {
          semanticMatch = { id: comp.id, title: comp.title, score, breakdown: { ...breakdown, method: "composite" }, method: "composite" };
          break;
        }
      }

      if (semanticMatch) {
        const detail = semanticMatch.method === "keyword"
          ? `Title keyword overlap: ${semanticMatch.breakdown.shared_count} shared words [${semanticMatch.breakdown.shared_words.join(", ")}] with: "${semanticMatch.title.substring(0, 80)}"`
          : `Composite similarity ${(semanticMatch.score * 100).toFixed(0)}% (uni:${(semanticMatch.breakdown.unigram * 100).toFixed(0)} bi:${(semanticMatch.breakdown.bigram * 100).toFixed(0)} ent:${(semanticMatch.breakdown.entity * 100).toFixed(0)}) to: "${semanticMatch.title.substring(0, 80)}"`;
        await logCandidate(supabase, run.id, article, "rejected", REJECTION_CODES.DEDUPED_SEMANTIC,
          detail, {
            pubDateParsed: pubDate,
            dedupeKey: dedupeKeyHash,
            dedupeSimilarityEvidence: {
              matched_title: semanticMatch.title,
              composite_score: semanticMatch.score,
              breakdown: semanticMatch.breakdown,
            },
            numbersFound: numberAnalysis.numbersFoundAll,
            numbersFoundQualifying: numberAnalysis.numbersFoundQualifying,
          });
        continue;
      }

      // PASSED ALL FILTERS
      qualifyingArticles.push({
        title: article.title,
        link: article.link,
        pubDate: article.pubDate,
        description: article.description,
        source_name: article.source_name,
        _pubDateParsed: pubDate,
        _fullText: fullText,
        _numbersFoundAll: numberAnalysis.numbersFoundAll,
        _numbersFoundQualifying: numberAnalysis.numbersFoundQualifying,
        _excludedNumbers: numberAnalysis.excludedNumbers,
        _dedupeKey: dedupeKeyHash,
        _dedupeKeyRaw: dedupeKeyRaw,
        _isOpinion: isOpinion,
      });

      console.log(`✓ PASSED ALL FILTERS: "${article.title.substring(0, 60)}..." (${numberAnalysis.qualifyingCount} qualifying numbers)`);
      
      if (isOpinion) {
        opinionsCreatedThisRun++;
      }
      articlesCreatedThisRun++;
      acceptedTitlesThisRun.push(article.title);
    }

    console.log(`Qualifying articles after all filters: ${qualifyingArticles.length}`);

    if (qualifyingArticles.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "completed",
        articles_found: 0,
        articles_created: 0,
        completed_at: new Date().toISOString(),
        metadata: { 
          method: "rss-feeds", 
          sources_checked: cappedSources.length, 
          time_window: timeWindowHours,
          version: "2.0",
          qualifying_number_rules: true
        }
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        method: "rss-feeds-v2",
        sources_checked: cappedSources.length,
        articles_found: 0,
        articles_created: 0,
        message: "No qualifying articles found with sufficient data quality",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sort by date and limit
    qualifyingArticles.sort((a, b) => b._pubDateParsed.getTime() - a._pubDateParsed.getTime());

    // ── Cross-source headline dedup (80% word overlap) ──
    // Keep the article from the higher-priority tier source
    const sourceTierMap = new Map<string, number>();
    for (const s of activeDbSources) sourceTierMap.set(s.name, s.priority_tier || 5);

    const headlineDeduped: typeof qualifyingArticles = [];
    for (const article of qualifyingArticles) {
      const articleWords = extractKeywords(article.title);
      let isDup = false;
      for (const kept of headlineDeduped) {
        const keptWords = extractKeywords(kept.title);
        const smaller = Math.min(articleWords.size, keptWords.size);
        if (smaller === 0) continue;
        let overlap = 0;
        for (const w of articleWords) { if (keptWords.has(w)) overlap++; }
        const overlapPct = overlap / smaller;
        if (overlapPct >= 0.80) {
          // Keep the one from higher-priority (lower tier number) source
          const articleTier = sourceTierMap.get(article.source_name) || 5;
          const keptTier = sourceTierMap.get(kept.source_name) || 5;
          if (articleTier < keptTier) {
            // Replace the kept one with this higher-priority source
            const idx = headlineDeduped.indexOf(kept);
            headlineDeduped[idx] = article;
            console.log(`🔄 Headline dedup: replaced "${kept.title.substring(0, 50)}..." (tier ${keptTier}) with tier ${articleTier}`);
          } else {
            console.log(`🔄 Headline dedup: dropped "${article.title.substring(0, 50)}..." (tier ${articleTier}, kept tier ${keptTier})`);
          }
          isDup = true;
          break;
        }
      }
      if (!isDup) headlineDeduped.push(article);
    }

    if (qualifyingArticles.length !== headlineDeduped.length) {
      console.log(`Headline dedup removed ${qualifyingArticles.length - headlineDeduped.length} cross-source duplicates`);
    }

    const remainingDailySlots = DAILY_PUBLISH_LIMIT - currentDailyCount;
    const toProcess = headlineDeduped.slice(0, Math.min(maxArticlesPerRun, remainingDailySlots));

    console.log(`Processing ${toProcess.length} articles (limited by daily cap: ${remainingDailySlots} remaining)`);

    // Insert into newsroom_articles
    const newsRecords = toProcess.map((item) => ({
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
        numbersFound: item._numbersFoundAll,
        numbersFoundQualifying: item._numbersFoundQualifying,
        excludedNumbers: item._excludedNumbers,
        newsroomArticleId: newsroomId,
      });
    }

    await supabase.from("newsroom_runs").update({
      articles_found: insertedNews?.length || 0,
    }).eq("id", run.id);

    // ============================================
    // BATCH CAP: Only process AI_BATCH_SIZE articles, mark overflow as pending_ai
    // ============================================
    const aiBatchItems = toProcess.slice(0, AI_BATCH_SIZE);
    const overflowItems = toProcess.slice(AI_BATCH_SIZE);

    if (overflowItems.length > 0) {
      console.log(`⏳ ${overflowItems.length} articles exceed batch cap — marking as pending_ai for next run`);
      for (let i = AI_BATCH_SIZE; i < toProcess.length; i++) {
        const newsroomRecord = insertedNews?.[i];
        if (newsroomRecord) {
          await supabase.from("newsroom_articles").update({
            processing_status: "pending_ai",
          }).eq("id", newsroomRecord.id);
        }
      }
    }

    // ============================================
    // PROCESS PENDING ARTICLES THROUGH AI & PUBLISH
    // ============================================
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let publishedCount = 0;
    const publishErrors: string[] = [];

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured — skipping AI processing");
    } else {
      // ============================================
      // OPTIMIZATION #2+#3: BATCH EDITORIAL PRE-SCREEN
      // Screen headlines in batches of 10 using flash-lite (cheapest model)
      // before spending on per-article rewrites with standard model
      // ============================================
      const nonAutoPassItems = aiBatchItems.filter(item => {
        const domain = sourceNameToDomain.get(item.source_name);
        return !domain || !AUTO_PASS_DOMAINS.has(domain);
      });

      let batchFilterResults = new Map<string, { pass: boolean; reason: string }>();
      
      if (nonAutoPassItems.length > 0) {
        console.log(`\n=== Batch editorial pre-screen: ${nonAutoPassItems.length} headlines ===`);
        
        // Process in batches of 10
        for (let batch = 0; batch < nonAutoPassItems.length; batch += 10) {
          const batchItems = nonAutoPassItems.slice(batch, batch + 10);
          const batchResults = await batchEditorialFilter(batchItems, lovableApiKey);
          for (const [title, result] of batchResults) {
            batchFilterResults.set(title, result);
          }
        }
        
        const passCount = [...batchFilterResults.values()].filter(r => r.pass).length;
        const failCount = [...batchFilterResults.values()].filter(r => !r.pass).length;
        console.log(`Batch filter results: ${passCount} PASS, ${failCount} FAIL`);
      }

      for (let i = 0; i < aiBatchItems.length; i++) {
        const item = aiBatchItems[i];
        const newsroomRecord = insertedNews?.[i];
        if (!newsroomRecord) continue;

        try {
          // Optimization #2: Check batch editorial filter result (skip expensive rewrite if failed)
          const batchResult = batchFilterResults.get(item.title);
          if (batchResult && !batchResult.pass) {
            console.log(`⊘ Batch filter REJECTED: "${item.title.substring(0, 60)}..." — ${batchResult.reason}`);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: `Batch editorial filter: ${batchResult.reason}`,
            }).eq("id", newsroomRecord.id);
            continue;
          }

          console.log(`\n=== Processing article ${i + 1}/${aiBatchItems.length}: "${item.title.substring(0, 60)}..." ===`);

          // 1. Fetch full page HTML for body content
          let sourceHtml = "";
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 15000);
            const pageResp = await fetch(item.link, {
              signal: controller.signal,
              headers: {
                "User-Agent": "StatsGH-Newsroom/2.0 (Content Reader)",
                "Accept": "text/html,application/xhtml+xml",
              },
            });
            clearTimeout(tid);
            if (pageResp.ok) {
              sourceHtml = await pageResp.text();
            }
          } catch (e) {
            console.log(`Page fetch failed for ${item.link}: ${e instanceof Error ? e.message : "Unknown"}`);
          }

          // Extract article text from HTML
          let articleText = item._fullText || "";
          if (sourceHtml && sourceHtml.length > articleText.length) {
            const cleaned = sourceHtml
              .replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
              .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
              .replace(/<header[\s\S]*?<\/header>/gi, " ")
              .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
              .replace(/<!--[\s\S]*?-->/g, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/gi, " ")
              .replace(/&amp;/gi, "&")
              .replace(/&lt;/gi, "<")
              .replace(/&gt;/gi, ">")
              .replace(/&quot;/gi, '"')
              .replace(/&#39;/gi, "'")
              .replace(/\s+/g, " ")
              .trim();
            if (cleaned.length > articleText.length) {
              articleText = cleaned.substring(0, 8000);
            }
          }

          if (articleText.length < 100) {
            console.log(`Article text too short (${articleText.length} chars), skipping`);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: "Source text too short for processing",
            }).eq("id", newsroomRecord.id);
            continue;
          }

          // 2. Call AI to restructure into article + generate metadata
          const aiPrompt = `You are a senior editor at Ghana's most respected data journalism publication. Your job is to write a complete, accurate news article of at least 400 words based on the source material provided.

Write clearly enough that a 12-year-old can understand every word you use. Write with the authority and precision of the Financial Times.

STRUCTURE (follow this exactly):
1. Lead paragraph (2-3 sentences): State the core fact immediately. What happened, who did it, what is the number or outcome. No scene-setting. No "In a recent development". No throat-clearing.
2. Supporting detail (3-4 sentences): Expand with the most important supporting detail — why it happened, what triggered it, who is affected.
3. Broader context (3-4 sentences): How does this fit into the broader Ghana economic or political story. Reference relevant data, trends, or prior events.
4. Attribution (2-3 sentences): Quote or attributed statement if available in the source. If none available, add expert or institutional context.
5. Implications (2-3 sentences): What happens next — implications, what to watch, what decision-makers or markets will respond to.

WRITING RULES:
- Short sentences. Maximum 25 words per sentence.
- Never use jargon without immediately explaining it in plain English in the same sentence.
- Use active voice. Never passive where active is possible.
- Numbers always in figures not words — write 500 million not five hundred million.
- Ghana cedi always written as GHS followed by the figure — GHS 4.2 billion.
- Never start a sentence with However, Furthermore, Additionally, Moreover, or In conclusion.
- Every paragraph must contain at least one specific fact, figure, name, or date.
- No filler phrases: remove "it is worth noting", "it should be mentioned", "as previously stated", "in light of the foregoing".
- No emojis, no decorative sections, ASCII characters only.
- Do not write a summary. Write a complete article. Minimum 400 words.

EDITORIAL FILTER:
Before writing, evaluate the story. Publish ONLY if it has economic/financial substance, affects markets, currency, banking, taxation, jobs, public finance, or involves large monetary values.
If the story fails the filter, return exactly: Rejected – Does not meet StatsGH economic impact threshold.

HEADLINE RULES:
- No colons, no long dashes, no dates in headline
- Include a key number if relevant
- Keep factual and direct

SOCIAL MEDIA:
Twitter (twitter_post): Maximum 160 characters. Must use present perfect tense: [Subject] has/have [past participle] [rest]. Must use "GHS" for currency. No hashtags, no emojis.
Instagram (instagram_post): Slightly longer. Must end with: Visit StatsGH.com to read more.

INPUT:
SOURCE HEADLINE: ${item.title}
SOURCE: ${item.source_name}
SOURCE URL: ${item.link}
SOURCE TEXT: ${articleText.substring(0, 6000)}

OUTPUT:
Return ONLY valid JSON with these exact keys:
{
"headline": "",
"subtitle": "",
"summary": "",
"seo_description": "",
"body_html": "",
"slug": "",
"category_slug": "one of: ${PREFERRED_CATEGORIES.join(", ")}",
"author_name": "",
"tags": [],
"twitter_post": "",
"instagram_post": ""
}`;

          console.log("Calling AI for article restructuring...");
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "user", content: aiPrompt },
              ],
            }),
          });

          let useRssFallback = false;

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            console.log(`AI call failed (${aiResp.status}): ${errText.substring(0, 200)} — using RSS fallback`);
            useRssFallback = true;
          }

          let aiContent: string | null = null;
          if (!useRssFallback) {
            const aiData = await aiResp.json();
            aiContent = aiData.choices?.[0]?.message?.content;

            if (!aiContent) {
              console.log("Empty AI response — using RSS fallback");
              useRssFallback = true;
            } else if (aiContent.trim().toLowerCase().startsWith("rejected")) {
              console.log(`AI REJECTED: "${item.title.substring(0, 60)}..." — using RSS fallback instead of dropping`);
              useRssFallback = true;
            }
          }

          // Parse JSON from AI response OR build RSS fallback
          let generated: any;

          if (useRssFallback) {
            // V6.0 FALLBACK: Publish a clean version from RSS data
            const fallbackSlug = item.title
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, "-")
              .substring(0, 80);
            const fallbackBody = item.description
              ? `<p>${item.description.replace(/\n/g, "</p><p>")}</p>`
              : `<p>${item.title}</p>`;
            const fallbackSummary = item.description
              ? item.description.substring(0, 300)
              : item.title;
            
            generated = {
              headline: item.title,
              subtitle: null,
              summary: fallbackSummary,
              seo_description: fallbackSummary.substring(0, 155),
              body_html: fallbackBody,
              slug: fallbackSlug,
              category_slug: DEFAULT_CATEGORY,
              author_name: item.source_name,
              tags: [],
              twitter_post: null,
              instagram_post: null,
            };
            console.log(`📋 RSS fallback article: "${item.title.substring(0, 60)}..."`);
          } else {
            try {
              const jsonMatch = aiContent!.match(/\{[\s\S]*\}/);
              if (!jsonMatch) throw new Error("No JSON found");
              generated = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
              // Parse failed — use RSS fallback instead of dropping
              console.log(`AI JSON parse failed, using RSS fallback: ${parseErr}`);
              const fallbackSlug = item.title
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .replace(/\s+/g, "-")
                .substring(0, 80);
              const fallbackBody = item.description
                ? `<p>${item.description.replace(/\n/g, "</p><p>")}</p>`
                : `<p>${item.title}</p>`;
              const fallbackSummary = item.description
                ? item.description.substring(0, 300)
                : item.title;
              
              generated = {
                headline: item.title,
                subtitle: null,
                summary: fallbackSummary,
                seo_description: fallbackSummary.substring(0, 155),
                body_html: fallbackBody,
                slug: fallbackSlug,
                category_slug: DEFAULT_CATEGORY,
                author_name: item.source_name,
                tags: [],
                twitter_post: null,
                instagram_post: null,
              };
            }

            // Validate required fields — fallback if missing
            if (!generated.headline || !generated.body_html || !generated.slug) {
              console.log("Missing required fields in AI output, using RSS fallback");
              const fallbackSlug = item.title
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .replace(/\s+/g, "-")
                .substring(0, 80);
              generated.headline = generated.headline || item.title;
              generated.body_html = generated.body_html || `<p>${item.description || item.title}</p>`;
              generated.slug = generated.slug || fallbackSlug;
              generated.summary = generated.summary || item.description || item.title;
            }
          }

          // 6. WORD COUNT GATE — minimum 350 words
          const bodyText = generated.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const wordCount = bodyText.split(/\s+/).filter((w: string) => w.length > 0).length;

          if (wordCount < 350) {
            console.log(`❌ REJECTED (TOO_SHORT): "${generated.headline?.substring(0, 60)}..." — ${wordCount} words (min 350)`);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: `TOO_SHORT: ${wordCount} words (minimum 350)`,
            }).eq("id", newsroomRecord.id);
            publishErrors.push(`TOO_SHORT (${wordCount}w): "${item.title.substring(0, 40)}"`);
            continue;
          }

          console.log(`Word count: ${wordCount} — passes minimum (350)`);

          // 7. Title quality gate — reject malformed titles
          const titleToCheck = generated.headline || "";
          const MALFORMED_CHARS = /[@#$\\|^]/;
          const FRONT_PAGES = /front\s*pages?:/i;
          const EXCESSIVE_CAPS = /[A-Z]{4,}/;
          if (MALFORMED_CHARS.test(titleToCheck) || FRONT_PAGES.test(titleToCheck) || titleToCheck.length < 20 || EXCESSIVE_CAPS.test(titleToCheck)) {
            console.log(`❌ REJECTED (MALFORMED_TITLE): "${titleToCheck.substring(0, 60)}"`);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: "MALFORMED_TITLE",
            }).eq("id", item._newsroomArticleId);
            continue;
          }

          // 8. Insert into articles table
          const { data: newArticle, error: articleError } = await supabase
            .from("articles")
            .insert({
              title: generated.headline,
              slug: uniqueSlug,
              category_slug: categorySlug,
              section: getSectionForCategory(categorySlug),
              summary: generated.summary || "",
              subtitle: generated.subtitle || null,
              seo_description: generated.seo_description || null,
              body: generated.body_html,
              author_name: authorName,
              hero_image_url: heroImageUrl,
              published_at: new Date().toISOString(),
              is_published: true,
              is_wire: false,
              word_count: wordCount,
              dedupe_key: item._dedupeKey,
              tags: Array.isArray(generated.tags) ? generated.tags : (generated.tags ? String(generated.tags).split(",").map((t: string) => t.trim()) : []),
              twitter_post: generated.twitter_post || null,
              instagram_comment: generated.instagram_post || "See full article link in bio.",
              status: "published",
            })
            .select("id")
            .single();

          if (articleError) {
            console.error(`Article insert failed: ${articleError.message}`);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: `DB insert failed: ${articleError.message}`,
            }).eq("id", newsroomRecord.id);
            publishErrors.push(`DB error for "${item.title.substring(0, 40)}"`);
            continue;
          }

          console.log(`✅ PUBLISHED: "${generated.headline.substring(0, 60)}..." (id: ${newArticle.id})`);

          // 7. Update newsroom_articles record
          await supabase.from("newsroom_articles").update({
            processing_status: "completed",
            generated_article_id: newArticle.id,
          }).eq("id", newsroomRecord.id);

          publishedCount++;

          // 8. Trigger indicator extraction (fire-and-forget)
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            fetch(`${supabaseUrl}/functions/v1/extract-article-indicators`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ articleId: newArticle.id }),
            }).catch(e => console.log(`Indicator extraction trigger failed: ${e}`));
          } catch (e) {
            console.log(`Indicator extraction error: ${e}`);
          }

          // 9. Auto-tweet the article immediately (synchronous, no queue)
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const tweetRes = await fetch(`${supabaseUrl}/functions/v1/tweet-article`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ articleId: newArticle.id }),
            });
            const tweetResult = await tweetRes.json().catch(() => ({}));
            if (tweetRes.ok && tweetResult.success) {
              console.log(`Auto-tweet posted for article ${newArticle.id}: ${tweetResult.tweetId || 'ok'}`);
            } else if (tweetResult.skipped) {
              console.log(`Auto-tweet skipped for article ${newArticle.id}: ${tweetResult.reason || tweetResult.message}`);
            } else {
              console.log(`Auto-tweet failed for article ${newArticle.id}: ${tweetResult.error || tweetRes.status} — discarding, no retry`);
            }
          } catch (e) {
            console.log(`Auto-tweet error (discarded, no retry): ${e}`);
          }

        } catch (itemError) {
          console.error(`Error processing article "${item.title.substring(0, 60)}":`, itemError);
          if (newsroomRecord) {
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: itemError instanceof Error ? itemError.message : "Unknown processing error",
            }).eq("id", newsroomRecord.id);
          }
          publishErrors.push(`Error: ${item.title.substring(0, 40)}`);
        }
      }

      // ============================================
      // PROCESS PENDING_AI FROM PREVIOUS RUNS
      // ============================================
      const remainingBatchSlots = AI_BATCH_SIZE - aiBatchItems.length;
      const pendingToProcess = (pendingAiArticles || []).slice(0, Math.max(0, remainingBatchSlots));
      
      if (pendingToProcess.length > 0) {
        console.log(`\n=== Processing ${pendingToProcess.length} pending_ai articles from previous runs ===`);
        
        for (const pendingItem of pendingToProcess) {
          try {
            console.log(`\n=== Pending_ai: "${pendingItem.original_headline.substring(0, 60)}..." ===`);
            
            let sourceHtml = "";
            if (pendingItem.source_url) {
              try {
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 15000);
                const pageResp = await fetch(pendingItem.source_url, {
                  signal: controller.signal,
                  headers: { "User-Agent": "StatsGH-Newsroom/2.0", "Accept": "text/html" },
                });
                clearTimeout(tid);
                if (pageResp.ok) sourceHtml = await pageResp.text();
              } catch (_e) { /* ignore fetch errors */ }
            }

            let articleText = pendingItem.original_summary || pendingItem.original_headline;
            if (sourceHtml && sourceHtml.length > articleText.length) {
              const cleaned = sourceHtml
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ").trim();
              if (cleaned.length > articleText.length) articleText = cleaned.substring(0, 8000);
            }

            const categorySlug = pendingItem.category_hint || "top-stories";
            const categoryId = await ensureCategoryExists(supabase, categorySlug);

            // Title quality gate for pending_ai fallback
            const pendingTitle = pendingItem.original_headline || "";
            const MALFORMED_CHARS_P = /[@#$\\|^]/;
            const FRONT_PAGES_P = /front\s*pages?:/i;
            const EXCESSIVE_CAPS_P = /[A-Z]{4,}/;
            if (MALFORMED_CHARS_P.test(pendingTitle) || FRONT_PAGES_P.test(pendingTitle) || pendingTitle.length < 20 || EXCESSIVE_CAPS_P.test(pendingTitle)) {
              console.log(`❌ REJECTED pending_ai (MALFORMED_TITLE): "${pendingTitle.substring(0, 60)}"`);
              await supabase.from("newsroom_articles").update({
                processing_status: "failed",
                error_message: "MALFORMED_TITLE",
              }).eq("id", pendingItem.id);
              continue;
            }

            // ── Run through the SAME AI editorial prompt as the main path ──
            const pendingAiPrompt = `You are a senior editor at Ghana's most respected data journalism publication. Your job is to write a complete, accurate news article of at least 400 words based on the source material provided.

Write clearly enough that a 12-year-old can understand every word you use. Write with the authority and precision of the Financial Times.

STRUCTURE (follow this exactly):
1. Lead paragraph (2-3 sentences): State the core fact immediately. What happened, who did it, what is the number or outcome. No scene-setting. No "In a recent development". No throat-clearing.
2. Supporting detail (3-4 sentences): Expand with the most important supporting detail — why it happened, what triggered it, who is affected.
3. Broader context (3-4 sentences): How does this fit into the broader Ghana economic or political story. Reference relevant data, trends, or prior events.
4. Attribution (2-3 sentences): Quote or attributed statement if available in the source. If none available, add expert or institutional context.
5. Implications (2-3 sentences): What happens next — implications, what to watch, what decision-makers or markets will respond to.

WRITING RULES:
- Short sentences. Maximum 25 words per sentence.
- Never use jargon without immediately explaining it in plain English in the same sentence.
- Use active voice. Never passive where active is possible.
- Numbers always in figures not words — write 500 million not five hundred million.
- Ghana cedi always written as GHS followed by the figure — GHS 4.2 billion.
- Never start a sentence with However, Furthermore, Additionally, Moreover, or In conclusion.
- Every paragraph must contain at least one specific fact, figure, name, or date.
- No filler phrases: remove "it is worth noting", "it should be mentioned", "as previously stated", "in light of the foregoing".
- No emojis, no decorative sections, ASCII characters only.
- Do not write a summary. Write a complete article. Minimum 400 words.

HEADLINE RULES:
- No colons, no long dashes, no dates in headline
- Include a key number if relevant
- Keep factual and direct

SOCIAL MEDIA:
Twitter (twitter_post): Maximum 160 characters. Must use present perfect tense: [Subject] has/have [past participle] [rest]. Must use "GHS" for currency. No hashtags, no emojis.
Instagram (instagram_post): Slightly longer. Must end with: Visit StatsGH.com to read more.

INPUT:
SOURCE HEADLINE: ${pendingItem.original_headline}
SOURCE: ${pendingItem.source_name}
SOURCE URL: ${pendingItem.source_url || "N/A"}
SOURCE TEXT: ${articleText.substring(0, 6000)}

OUTPUT:
Return ONLY valid JSON with these exact keys:
{
"headline": "",
"subtitle": "",
"summary": "",
"seo_description": "",
"body_html": "",
"slug": "",
"category_slug": "one of: ${PREFERRED_CATEGORIES.join(", ")}",
"author_name": "",
"tags": [],
"twitter_post": "",
"instagram_post": ""
}`;

            console.log("Calling AI for pending_ai article restructuring...");
            const pendingAiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: pendingAiPrompt }],
              }),
            });

            if (!pendingAiResp.ok) {
              const errText = await pendingAiResp.text();
              console.log(`❌ AI call failed for pending_ai (${pendingAiResp.status}): ${errText.substring(0, 200)}`);
              await supabase.from("newsroom_articles").update({
                processing_status: "failed",
                error_message: `AI_CALL_FAILED: ${pendingAiResp.status}`,
              }).eq("id", pendingItem.id);
              continue;
            }

            const pendingAiData = await pendingAiResp.json();
            const pendingAiContent = pendingAiData.choices?.[0]?.message?.content;

            if (!pendingAiContent || pendingAiContent.trim().toLowerCase().startsWith("rejected")) {
              console.log(`❌ AI rejected/empty for pending_ai: "${pendingTitle.substring(0, 60)}..."`);
              await supabase.from("newsroom_articles").update({
                processing_status: "failed",
                error_message: pendingAiContent ? "AI_REJECTED" : "AI_EMPTY_RESPONSE",
              }).eq("id", pendingItem.id);
              continue;
            }

            // Parse AI JSON response
            let pendingGenerated: any;
            try {
              const jsonMatch = pendingAiContent.match(/\{[\s\S]*\}/);
              if (!jsonMatch) throw new Error("No JSON found in AI response");
              pendingGenerated = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
              console.log(`❌ Failed to parse AI JSON for pending_ai: "${pendingTitle.substring(0, 60)}..."`);
              await supabase.from("newsroom_articles").update({
                processing_status: "failed",
                error_message: "AI_JSON_PARSE_FAILED",
              }).eq("id", pendingItem.id);
              continue;
            }

            // Word count gate — minimum 350 words on AI-generated body
            const pendingBodyText = (pendingGenerated.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const pendingWordCount = pendingBodyText.split(/\s+/).filter((w: string) => w.length > 0).length;

            if (pendingWordCount < 350) {
              console.log(`❌ REJECTED pending_ai (TOO_SHORT_FALLBACK): "${pendingTitle.substring(0, 60)}..." — ${pendingWordCount} words (min 350)`);
              await supabase.from("newsroom_articles").update({
                processing_status: "failed",
                error_message: `TOO_SHORT_FALLBACK: ${pendingWordCount} words (minimum 350)`,
              }).eq("id", pendingItem.id);
              continue;
            }

            const slug = (pendingGenerated.slug || pendingItem.original_headline
              .toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 80)) + "-" + Date.now();
            const finalCategorySlug = pendingGenerated.category_slug || categorySlug;
            const finalCategoryId = await ensureCategoryExists(supabase, finalCategorySlug);

            const { data: newArticle, error: artError } = await supabase
              .from("articles")
              .insert({
                title: pendingGenerated.headline || pendingItem.original_headline,
                slug,
                body: pendingGenerated.body_html,
                summary: (pendingGenerated.summary || pendingItem.original_summary || pendingItem.original_headline).substring(0, 300),
                subtitle: pendingGenerated.subtitle || null,
                seo_description: pendingGenerated.seo_description || null,
                meta_title: pendingGenerated.headline || pendingItem.original_headline,
                author_name: pendingGenerated.author_name || "StatsGH Newsroom",
                section: getSectionForCategory(finalCategorySlug),
                category_slug: finalCategorySlug,
                category_id: finalCategoryId,
                is_published: true,
                published_at: pendingItem.published_at || new Date().toISOString(),
                is_wire: true,
                word_count: pendingWordCount,
                status: "published",
                tags: pendingGenerated.tags || [],
                twitter_post: pendingGenerated.twitter_post || null,
                instagram_comment: pendingGenerated.instagram_post || null,
              })
              .select().single();

            if (artError) throw artError;

            await supabase.from("newsroom_articles").update({
              processing_status: "published",
              generated_article_id: newArticle.id,
            }).eq("id", pendingItem.id);

            publishedCount++;
            console.log(`✅ PUBLISHED (pending_ai): "${(pendingGenerated.headline || pendingItem.original_headline).substring(0, 60)}..." (${pendingWordCount} words, id: ${newArticle.id})`);
          } catch (e) {
            console.error(`Error processing pending_ai:`, e);
            await supabase.from("newsroom_articles").update({
              processing_status: "failed",
              error_message: e instanceof Error ? e.message : "Unknown error",
            }).eq("id", pendingItem.id);
          }
        }
      }
    }

    console.log(`\n=== Run complete: ${publishedCount} published out of ${aiBatchItems.length} processed (${overflowItems.length} deferred as pending_ai) ===`);
    if (publishErrors.length > 0) {
      console.log(`Errors: ${publishErrors.join("; ")}`);
    }

    // Complete run metadata
    await supabase.from("newsroom_runs").update({
      status: "completed",
      articles_created: publishedCount,
      completed_at: new Date().toISOString(),
      metadata: { 
        method: "rss-feeds-v3-optimized", 
        sources_checked: cappedSources.length, 
        time_window: timeWindowHours,
        version: "3.0",
        qualifying_number_rules: true,
        daily_limit: DAILY_PUBLISH_LIMIT,
        opinion_limit: DAILY_OPINION_LIMIT,
        candidates: toProcess.length,
        ai_batch_processed: aiBatchItems.length,
        deferred_pending_ai: overflowItems.length,
        published: publishedCount,
        optimizations: {
          pre_filter_blocked: preFilterBlockedCount,
          source_skipped: sourceSkippedCount,
          high_rejection_sources: [...highRejectionSources],
        },
        errors: publishErrors.length > 0 ? publishErrors : undefined,
      }
    }).eq("id", run.id);

    return new Response(JSON.stringify({
      success: true,
      run_id: run.id,
      method: "rss-feeds-v3-optimized",
      version: "3.0",
      sources_checked: cappedSources.length,
      articles_found: insertedNews?.length || 0,
      articles_published: publishedCount,
      articles_deferred: overflowItems.length,
      articles_failed: aiBatchItems.length - publishedCount,
      time_window_hours: timeWindowHours,
      daily_limit: DAILY_PUBLISH_LIMIT,
      opinion_limit: DAILY_OPINION_LIMIT,
      pre_filter_blocked: preFilterBlockedCount,
      source_skipped: sourceSkippedCount,
      errors: publishErrors.length > 0 ? publishErrors : undefined,
      message: `V3.0: ${publishedCount} published, ${preFilterBlockedCount} pre-filtered, ${sourceSkippedCount} source-skipped`,
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
