import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================
// STATSGH RESEARCH SCANNER
// Scans academic and thesis repositories for Ghana-related research
// Converts qualifying items into StatsGH news articles
// ============================================

function collapseImmediateWordRepeats(input: string): string {
  if (!input) return input;
  let s = String(input).replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) {
    s = s.replace(/\b([a-zA-Z]+)\b([\s.,;:!?]+\1\b)+/gi, "$1");
    s = s.replace(/\s+/g, " ").trim();
  }
  return s;
}

const PREFERRED_CATEGORIES = [
  "macroeconomy", "markets", "public-finance", "banking-and-finance",
  "energy-and-utilities", "trade-and-industry", "corporate-ghana",
  "agriculture-and-commodities", "infrastructure-and-transport",
  "data-and-research", "regulation-and-policy", "technology-and-digital-economy",
  "labour-and-jobs", "regional-economy",
] as const;

const DEFAULT_CATEGORY = "data-and-research";

// ============================================
// ACADEMIC REPOSITORY SOURCES
// ============================================
interface RepoSource {
  name: string;
  type: "oai-pmh" | "rss" | "api" | "html";
  url: string;
  searchUrl?: string;
  ghanaFilter?: string;
}

const REPO_SOURCES: RepoSource[] = [
  // Ghanaian university repositories (DSpace OAI-PMH)
  {
    name: "UGSpace (University of Ghana)",
    type: "oai-pmh",
    url: "https://ugspace.ug.edu.gh/oai/request",
  },
  {
    name: "KNUST Institutional Repository",
    type: "oai-pmh",
    url: "http://ir.knust.edu.gh/oai/request",
  },
  {
    name: "UCC Institutional Repository",
    type: "oai-pmh",
    url: "https://ir.ucc.edu.gh/oai/request",
  },
  // International repositories with Ghana content
  {
    name: "World Bank Open Knowledge",
    type: "rss",
    url: "https://openknowledge.worldbank.org/feed/search?query=ghana+economy&sortBy=datePublished&order=desc",
    searchUrl: "https://openknowledge.worldbank.org/search?query=ghana",
  },
  {
    name: "IMF Ghana Reports",
    type: "rss",
    url: "https://www.imf.org/en/Countries/GHA/rss",
    searchUrl: "https://www.imf.org/en/Countries/GHA",
  },
  {
    name: "AfDB Ghana Reports",
    type: "rss",
    url: "https://www.afdb.org/en/countries/west-africa/ghana/feed",
    searchUrl: "https://www.afdb.org/en/countries/west-africa/ghana",
  },
  {
    name: "AERC Working Papers",
    type: "rss",
    url: "https://aercafrica.org/feed/",
    ghanaFilter: "ghana",
  },
  {
    name: "Ashesi Digital Commons",
    type: "rss",
    url: "https://air.ashesi.edu.gh/feed/",
  },
  // Thesis aggregators (HTML scrape fallback)
  {
    name: "NDLTD (Networked Digital Library)",
    type: "html",
    url: "https://ndltd.org/search/?q=ghana+economy&sort=date",
    ghanaFilter: "ghana",
  },
];

// ============================================
// GHANA ECONOMIC RELEVANCE KEYWORDS
// ============================================
const GHANA_KEYWORDS = [
  "ghana", "ghanaian", "accra", "kumasi", "tamale", "takoradi", "tema",
  "ashanti", "volta", "cedi", "cedis", "ghs", "ghc",
  "bank of ghana", "bog", "cocobod", "gnpc", "gse", "gra",
  "ecg", "vra", "purc", "npa", "ssnit",
];

const ECONOMIC_KEYWORDS = [
  "inflation", "gdp", "economic growth", "fiscal", "monetary policy",
  "employment", "unemployment", "labour", "labor", "wages", "salary",
  "tax", "taxation", "revenue", "budget", "public finance", "debt",
  "trade", "export", "import", "tariff", "customs",
  "banking", "finance", "credit", "microfinance", "fintech",
  "energy", "electricity", "fuel", "oil", "gas", "mining",
  "agriculture", "cocoa", "food security", "crop", "farming",
  "poverty", "inequality", "welfare", "social protection",
  "education economics", "health economics", "human capital",
  "investment", "fdi", "capital", "stock market",
  "exchange rate", "currency", "remittance",
  "infrastructure", "transport", "housing", "construction",
  "digital economy", "technology", "mobile money",
  "regulation", "policy", "reform", "governance",
  "regional development", "urbanization", "decentralization",
  "price", "cost", "index", "rate", "percent", "growth", "decline",
  "billion", "million", "data", "survey", "census", "statistics",
];

// ============================================
// OAI-PMH HARVESTER
// ============================================
interface ResearchItem {
  title: string;
  authors: string;
  abstract: string;
  url: string;
  publishedDate: string;
  sourceName: string;
  identifier: string;
}

async function harvestOaiPmh(source: RepoSource, fromDate: string): Promise<ResearchItem[]> {
  const items: ResearchItem[] = [];
  try {
    // ListRecords with from date filter
    const oaiUrl = `${source.url}?verb=ListRecords&metadataPrefix=oai_dc&from=${fromDate}`;
    console.log(`OAI-PMH: Fetching ${source.name}: ${oaiUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(oaiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "StatsGH-ResearchScanner/1.0",
        "Accept": "application/xml, text/xml",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`OAI-PMH fetch failed for ${source.name}: ${response.status}`);
      return items;
    }

    const xml = await response.text();

    // Parse OAI-PMH records
    const recordRegex = /<record>([\s\S]*?)<\/record>/gi;
    let match;

    while ((match = recordRegex.exec(xml)) !== null) {
      const record = match[1];

      const titleMatch = record.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

      const creatorMatches = [...record.matchAll(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/gi)];
      const authors = creatorMatches.map(m => m[1].trim()).join(", ");

      const descMatches = [...record.matchAll(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/gi)];
      const abstract = descMatches.map(m => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()).join(" ");

      const identifierMatches = [...record.matchAll(/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/gi)];
      let url = "";
      let identifier = "";
      for (const im of identifierMatches) {
        const val = im[1].trim();
        if (val.startsWith("http")) {
          url = val;
        }
        if (!identifier) identifier = val;
      }

      const dateMatch = record.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
      const publishedDate = dateMatch ? dateMatch[1].trim() : "";

      if (title && (url || identifier)) {
        items.push({
          title,
          authors,
          abstract: abstract.substring(0, 3000),
          url: url || identifier,
          publishedDate,
          sourceName: source.name,
          identifier: identifier || url,
        });
      }
    }

    console.log(`OAI-PMH: ${source.name} returned ${items.length} records`);
  } catch (error) {
    console.log(`OAI-PMH error for ${source.name}: ${error instanceof Error ? error.message : "Unknown"}`);
  }
  return items;
}

// ============================================
// RSS HARVESTER
// ============================================
async function harvestRss(source: RepoSource): Promise<ResearchItem[]> {
  const items: ResearchItem[] = [];
  try {
    console.log(`RSS: Fetching ${source.name}: ${source.url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "StatsGH-ResearchScanner/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`RSS fetch failed for ${source.name}: ${response.status}`);
      return items;
    }

    const xml = await response.text();

    // Parse RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];

      const titleMatch = itemContent.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

      const linkMatch = itemContent.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      const url = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

      const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
      const publishedDate = pubDateMatch ? pubDateMatch[1].trim() : "";

      const descMatch = itemContent.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      let abstract = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
      abstract = abstract.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      const creatorMatch = itemContent.match(/<dc:creator[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i);
      const authors = creatorMatch ? creatorMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

      if (title && url) {
        items.push({
          title,
          authors,
          abstract: abstract.substring(0, 3000),
          url,
          publishedDate,
          sourceName: source.name,
          identifier: url,
        });
      }
    }

    // Also parse Atom entries
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryContent = match[1];

      const titleMatch = entryContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";

      const linkMatch = entryContent.match(/<link[^>]+href="([^"]+)"/i);
      const url = linkMatch ? linkMatch[1].trim() : "";

      const updatedMatch = entryContent.match(/<(?:updated|published)[^>]*>([\s\S]*?)<\/(?:updated|published)>/i);
      const publishedDate = updatedMatch ? updatedMatch[1].trim() : "";

      const summaryMatch = entryContent.match(/<(?:summary|content)[^>]*>([\s\S]*?)<\/(?:summary|content)>/i);
      let abstract = summaryMatch ? summaryMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
      abstract = abstract.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      const authorMatch = entryContent.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/i);
      const authors = authorMatch ? authorMatch[1].trim() : "";

      if (title && url) {
        items.push({
          title,
          authors,
          abstract: abstract.substring(0, 3000),
          url,
          publishedDate,
          sourceName: source.name,
          identifier: url,
        });
      }
    }

    console.log(`RSS: ${source.name} returned ${items.length} items`);
  } catch (error) {
    console.log(`RSS error for ${source.name}: ${error instanceof Error ? error.message : "Unknown"}`);
  }
  return items;
}

// ============================================
// RELEVANCE FILTER
// ============================================
function isGhanaEconomicResearch(item: ResearchItem): { passes: boolean; detail: string } {
  const text = `${item.title} ${item.abstract}`.toLowerCase();

  // Ghana relevance
  const ghanaHits = GHANA_KEYWORDS.filter(kw => text.includes(kw));
  if (ghanaHits.length === 0) {
    // For Ghanaian university repos, the source itself implies Ghana relevance
    const isGhanaRepo = item.sourceName.includes("UGSpace") ||
      item.sourceName.includes("KNUST") ||
      item.sourceName.includes("UCC") ||
      item.sourceName.includes("GIMPA") ||
      item.sourceName.includes("Ashesi");

    if (!isGhanaRepo) {
      return { passes: false, detail: "No Ghana keywords found" };
    }
  }

  // Economic/policy relevance
  const econHits = ECONOMIC_KEYWORDS.filter(kw => text.includes(kw));
  if (econHits.length === 0) {
    return { passes: false, detail: "No economic/policy keywords found" };
  }

  // Check for measurable findings (numbers, statistics)
  const hasNumbers = /\d+(?:\.\d+)?(?:\s*%|\s*percent|\s*million|\s*billion|\s*ghs|\s*usd)/i.test(text);
  const hasFindings = /\b(?:found|shows|reveals|indicates|suggests|concludes|result|significant|correlation|impact|effect|increase|decrease|growth|decline)\b/i.test(text);

  if (!hasNumbers && !hasFindings) {
    return { passes: false, detail: "No measurable findings detected" };
  }

  return {
    passes: true,
    detail: `Ghana: [${ghanaHits.slice(0, 3).join(", ")}], Econ: [${econHits.slice(0, 3).join(", ")}]`,
  };
}

// ============================================
// FRESHNESS CHECK (last 7 days)
// ============================================
function isWithinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return d >= cutoff;
  } catch {
    return false;
  }
}

// ============================================
// DEDUPE
// ============================================
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================
// CATEGORY HELPER
// ============================================
async function ensureCategoryExists(supabase: any, slug: string): Promise<string> {
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
  if (!cleanSlug || cleanSlug.length < 2) return DEFAULT_CATEGORY;

  const { data: existing } = await supabase
    .from("categories")
    .select("slug")
    .eq("slug", cleanSlug)
    .limit(1);

  if (existing && existing.length > 0) return cleanSlug;

  const name = cleanSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const { error } = await supabase.from("categories").insert({
    name, slug: cleanSlug,
    description: `Auto-created category for ${name} articles`,
    color: "#262626",
  });

  if (error) {
    console.log(`Could not create category ${cleanSlug}: ${error.message}`);
    return DEFAULT_CATEGORY;
  }
  return cleanSlug;
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const freshnessWindowDays = Number(body.freshness_days ?? 7);
    const maxItems = Number(body.max_items ?? 20);

    // Calculate OAI-PMH from date (ISO date only)
    const fromDate = new Date(Date.now() - freshnessWindowDays * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    console.log(`=== RESEARCH SCAN START ===`);
    console.log(`Freshness window: ${freshnessWindowDays} days (from ${fromDate})`);
    console.log(`Max items to process: ${maxItems}`);

    // Create run record
    const { data: run, error: runError } = await supabase
      .from("newsroom_runs")
      .insert({
        trigger_type: "research-scan",
        status: "running",
        articles_found: 0,
        articles_created: 0,
      })
      .select()
      .single();

    if (runError) throw new Error(`Failed to create run: ${runError.message}`);

    // ============================================
    // HARVEST FROM ALL SOURCES
    // ============================================
    const allItems: ResearchItem[] = [];

    const harvestPromises = REPO_SOURCES.map(async (source) => {
      try {
        let items: ResearchItem[] = [];

        if (source.type === "oai-pmh") {
          items = await harvestOaiPmh(source, fromDate);
        } else if (source.type === "rss") {
          items = await harvestRss(source);
        }
        // html type skipped for now — can be added later

        // Apply Ghana filter for international sources
        if (source.ghanaFilter) {
          items = items.filter(item => {
            const text = `${item.title} ${item.abstract}`.toLowerCase();
            return text.includes(source.ghanaFilter!);
          });
          console.log(`${source.name}: ${items.length} items after Ghana filter`);
        }

        return items;
      } catch (err) {
        console.log(`Source error ${source.name}: ${err instanceof Error ? err.message : "Unknown"}`);
        return [];
      }
    });

    const results = await Promise.all(harvestPromises);
    results.forEach(items => allItems.push(...items));

    console.log(`Total items harvested: ${allItems.length}`);

    // ============================================
    // FILTER: FRESHNESS + RELEVANCE + DEDUPE
    // ============================================
    const qualifying: ResearchItem[] = [];
    let skippedFreshness = 0;
    let skippedRelevance = 0;
    let skippedDedupe = 0;

    for (const item of allItems) {
      // Freshness check
      if (!isWithinDays(item.publishedDate, freshnessWindowDays)) {
        skippedFreshness++;
        continue;
      }

      // Relevance check
      const relevance = isGhanaEconomicResearch(item);
      if (!relevance.passes) {
        skippedRelevance++;
        continue;
      }

      // Dedupe against existing articles
      const dedupeRaw = `${item.title.substring(0, 80)} ${item.sourceName}`.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const dedupeKey = await sha256Hex(dedupeRaw);

      const { data: existingArticle } = await supabase
        .from("articles")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .limit(1);

      if (existingArticle && existingArticle.length > 0) {
        skippedDedupe++;
        continue;
      }

      const { data: existingNewsroom } = await supabase
        .from("newsroom_articles")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .limit(1);

      if (existingNewsroom && existingNewsroom.length > 0) {
        skippedDedupe++;
        continue;
      }

      // Store dedupeKey on the item for later use
      (item as any)._dedupeKey = dedupeKey;
      (item as any)._relevanceDetail = relevance.detail;

      qualifying.push(item);

      if (qualifying.length >= maxItems) break;
    }

    console.log(`After filtering: ${qualifying.length} qualifying (skipped: ${skippedFreshness} freshness, ${skippedRelevance} relevance, ${skippedDedupe} dedupe)`);

    if (qualifying.length === 0) {
      await supabase.from("newsroom_runs").update({
        status: "completed",
        articles_found: 0,
        articles_created: 0,
        completed_at: new Date().toISOString(),
        metadata: {
          method: "research-scan",
          sources_checked: REPO_SOURCES.length,
          total_harvested: allItems.length,
          skipped_freshness: skippedFreshness,
          skipped_relevance: skippedRelevance,
          skipped_dedupe: skippedDedupe,
        },
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true,
        run_id: run.id,
        method: "research-scan",
        items_harvested: allItems.length,
        items_qualifying: 0,
        articles_published: 0,
        message: "No qualifying research items found",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // INSERT INTO NEWSROOM_ARTICLES + AI PROCESSING
    // ============================================
    let publishedCount = 0;
    const errors: string[] = [];

    for (const item of qualifying) {
      const dedupeKey = (item as any)._dedupeKey;

      try {
        // Insert newsroom_articles record
        const { data: newsRecord, error: insertErr } = await supabase
          .from("newsroom_articles")
          .insert({
            source_name: item.sourceName,
            original_headline: item.title.substring(0, 500),
            original_summary: item.abstract.substring(0, 1000) || null,
            source_url: item.url,
            published_at: item.publishedDate ? new Date(item.publishedDate).toISOString() : new Date().toISOString(),
            dedupe_key: dedupeKey,
            processing_status: "pending",
            category_hint: "data-and-research",
          })
          .select()
          .single();

        if (insertErr) {
          console.log(`Insert error for "${item.title.substring(0, 40)}": ${insertErr.message}`);
          errors.push(`Insert: ${item.title.substring(0, 40)}`);
          continue;
        }

        // Log candidate
        await supabase.from("newsroom_candidates").insert({
          run_id: run.id,
          source_name: item.sourceName,
          source_url: item.url,
          headline: item.title.substring(0, 500),
          rss_summary: item.abstract.substring(0, 1000) || null,
          fetched_full_text: item.abstract.substring(0, 2000) || null,
          pub_date_raw: item.publishedDate,
          pub_date_parsed: item.publishedDate ? new Date(item.publishedDate).toISOString() : null,
          decision: "accepted",
          dedupe_key: dedupeKey,
          newsroom_article_id: newsRecord.id,
        }).catch(e => console.log(`Candidate log error: ${e}`));

        // AI rewrite prompt
        const aiPrompt = `You are the Editor in Chief of StatsGH, a data-driven news platform about Ghana's economy.

A new academic research paper or report has been published. Your task is to convert it into a public-facing news article that explains what the research found, why it matters, and what it could mean for Ghana.

EDITORIAL FILTER
Only proceed if the research has clear economic or policy relevance to Ghana and contains measurable findings (numbers, percentages, statistical results). If it lacks these, return:
Rejected – Research lacks measurable economic findings relevant to Ghana.

WRITING RULES
- Maximum 450 words, designed for 2-minute read
- Simple English readable by a 10-year-old
- Short paragraphs, no bullet points in body
- No colons or long dashes in headline
- No emojis, hashtags, or decorative elements
- ASCII characters only
- Do NOT invent numbers — only use what appears in the research
- Explain technical terms in brackets on first use
- Include the key finding and any numbers prominently

STRUCTURE
1. What the research found
2. Why it matters for Ghana's economy
3. The key numbers
4. What it could mean going forward
5. Who conducted the research

SOCIAL MEDIA
- Twitter: max 140 chars, no emojis or hashtags
- Instagram: slightly longer, must end with "Visit StatsGH.com to read more."

CATEGORY
Default to "data-and-research" unless another approved category fits better.

INPUT

TITLE: ${item.title}
AUTHORS: ${item.authors || "Not specified"}
SOURCE: ${item.sourceName}
URL: ${item.url}

ABSTRACT/CONTENT:
${item.abstract.substring(0, 5000)}

OUTPUT
Return ONLY valid JSON:
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

        console.log(`AI processing: "${item.title.substring(0, 60)}..."`);

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: aiPrompt }],
          }),
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          console.log(`AI error ${aiResp.status}: ${errText.substring(0, 200)}`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `AI error ${aiResp.status}`,
          }).eq("id", newsRecord.id);
          errors.push(`AI ${aiResp.status}: ${item.title.substring(0, 40)}`);
          continue;
        }

        const aiData = await aiResp.json();
        const aiContent = aiData.choices?.[0]?.message?.content;

        if (!aiContent) {
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: "Empty AI response",
          }).eq("id", newsRecord.id);
          continue;
        }

        // Check for AI rejection
        if (aiContent.trim().toLowerCase().startsWith("rejected")) {
          console.log(`AI REJECTED: "${item.title.substring(0, 60)}..."`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `AI rejection: ${aiContent.trim().substring(0, 200)}`,
          }).eq("id", newsRecord.id);
          continue;
        }

        // Parse JSON
        let generated: any;
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found");
          generated = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
          console.log(`JSON parse error: ${parseErr}`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: "AI response JSON parse failed",
          }).eq("id", newsRecord.id);
          errors.push(`Parse: ${item.title.substring(0, 40)}`);
          continue;
        }

        if (!generated.headline || !generated.body_html || !generated.slug) {
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: "Missing headline/body/slug in AI output",
          }).eq("id", newsRecord.id);
          continue;
        }

        // Clean fields
        generated.headline = collapseImmediateWordRepeats(generated.headline);
        generated.summary = collapseImmediateWordRepeats(generated.summary || "");
        if (generated.summary.length > 400) generated.summary = generated.summary.substring(0, 397) + "...";
        if (generated.seo_description?.length > 155) generated.seo_description = generated.seo_description.substring(0, 152) + "...";

        // Validate category — default to data-and-research
        const categorySlug = PREFERRED_CATEGORIES.includes(generated.category_slug)
          ? generated.category_slug
          : DEFAULT_CATEGORY;

        await ensureCategoryExists(supabase, categorySlug);

        const uniqueSlug = `${generated.slug.substring(0, 80)}-${Date.now()}`;
        const bodyText = generated.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const wordCount = bodyText.split(/\s+/).length;

        let authorName = generated.author_name || "StatsGH Newsroom";
        if (item.authors && item.authors !== "Not specified") {
          // Credit original researchers
          authorName = `StatsGH Newsroom (Research: ${item.authors.substring(0, 100)})`;
        }

        // Generate AI hero image
        let heroImageUrl: string | null = null;
        try {
          const photoPrompt = `${generated.headline}. Setting: Ghana, West Africa. Academic research, university, data analysis, economics.`;
          
          const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [{
                role: "user",
                content: `Create a photograph that looks exactly like a real editorial photo from a wire service. SUBJECT: ${photoPrompt}. Documentary journalism style, natural lighting, 16:9, no text overlays, no identifiable faces, no AI look. Must look like Financial Times photography.`,
              }],
              modalities: ["image", "text"],
            }),
          });

          if (imgResp.ok) {
            const imgData = await imgResp.json();
            const imageDataUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (imageDataUrl?.startsWith("data:image")) {
              const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
              if (base64Match) {
                const [, format, base64Data] = base64Match;
                const bytes = Uint8Array.from(atob(base64Data), (c: string) => c.charCodeAt(0));
                const ext = format === "png" ? "png" : "jpg";
                const imagePath = `newsroom/${uniqueSlug}-research.${ext}`;

                const { error: uploadErr } = await supabase.storage
                  .from("media")
                  .upload(imagePath, bytes, {
                    contentType: `image/${format === "png" ? "png" : "jpeg"}`,
                    upsert: true,
                  });

                if (!uploadErr) {
                  const { data: publicUrl } = supabase.storage.from("media").getPublicUrl(imagePath);
                  heroImageUrl = publicUrl.publicUrl;
                  console.log(`Research image uploaded: ${heroImageUrl}`);
                }
              }
            }
          }
        } catch (imgErr) {
          console.log(`Image generation error: ${imgErr instanceof Error ? imgErr.message : "Unknown"}`);
        }

        // Insert article
        const { data: newArticle, error: articleError } = await supabase
          .from("articles")
          .insert({
            title: generated.headline,
            slug: uniqueSlug,
            category_slug: categorySlug,
            section: categorySlug,
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
            dedupe_key: dedupeKey,
            tags: Array.isArray(generated.tags)
              ? generated.tags
              : generated.tags ? String(generated.tags).split(",").map((t: string) => t.trim()) : [],
            twitter_post: generated.twitter_post || null,
            instagram_comment: generated.instagram_post || "See full article link in bio.",
            status: "published",
          })
          .select("id")
          .single();

        if (articleError) {
          console.log(`Article insert error: ${articleError.message}`);
          await supabase.from("newsroom_articles").update({
            processing_status: "failed",
            error_message: `DB insert: ${articleError.message}`,
          }).eq("id", newsRecord.id);
          errors.push(`DB: ${item.title.substring(0, 40)}`);
          continue;
        }

        console.log(`✅ PUBLISHED RESEARCH: "${generated.headline.substring(0, 60)}..." (id: ${newArticle.id})`);

        await supabase.from("newsroom_articles").update({
          processing_status: "completed",
          generated_article_id: newArticle.id,
        }).eq("id", newsRecord.id);

        publishedCount++;

        // Fire-and-forget: indicator extraction + tweet
        const fnUrl = Deno.env.get("SUPABASE_URL")!;
        const fnKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        fetch(`${fnUrl}/functions/v1/extract-article-indicators`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${fnKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: newArticle.id }),
        }).catch(e => console.log(`Indicator extraction failed: ${e}`));

        fetch(`${fnUrl}/functions/v1/tweet-article`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${fnKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ articleId: newArticle.id }),
        }).catch(e => console.log(`Auto-tweet failed: ${e}`));

      } catch (itemError) {
        console.log(`Error processing "${item.title.substring(0, 40)}": ${itemError instanceof Error ? itemError.message : "Unknown"}`);
        errors.push(`Error: ${item.title.substring(0, 40)}`);
      }
    }

    // Complete run
    await supabase.from("newsroom_runs").update({
      status: "completed",
      articles_found: qualifying.length,
      articles_created: publishedCount,
      completed_at: new Date().toISOString(),
      metadata: {
        method: "research-scan",
        version: "1.0",
        sources_checked: REPO_SOURCES.length,
        total_harvested: allItems.length,
        qualifying: qualifying.length,
        published: publishedCount,
        skipped_freshness: skippedFreshness,
        skipped_relevance: skippedRelevance,
        skipped_dedupe: skippedDedupe,
        errors: errors.length > 0 ? errors : undefined,
      },
    }).eq("id", run.id);

    console.log(`=== RESEARCH SCAN COMPLETE: ${publishedCount} published from ${qualifying.length} qualifying ===`);

    return new Response(JSON.stringify({
      success: true,
      run_id: run.id,
      method: "research-scan",
      sources_checked: REPO_SOURCES.length,
      items_harvested: allItems.length,
      items_qualifying: qualifying.length,
      articles_published: publishedCount,
      freshness_window_days: freshnessWindowDays,
      skipped: { freshness: skippedFreshness, relevance: skippedRelevance, dedupe: skippedDedupe },
      errors: errors.length > 0 ? errors : undefined,
      message: `Research scan: ${publishedCount} articles published from ${qualifying.length} qualifying items`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Research scan error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
