import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Free data source configs (no API key needed) ──────────────────────────
const WORLD_BANK_BASE = "https://api.worldbank.org/v2/country/GHA/indicator";

const INDICATORS = [
  {
    key: "INFLATION_YOY",
    source: "WorldBank",
    wbCode: "FP.CPI.TOTL.ZG",
    unit: "%",
    dbSlug: "cpi-inflation",
    topics: ["inflation", "cpi"],
  },
  {
    key: "POLICY_RATE",
    source: "CediRates",
    unit: "%",
    dbSlug: "policy-rate",
    topics: ["mpc", "policy rate", "interest rate", "monetary policy"],
  },
  {
    key: "EXCHANGE_RATE_USD_GHS",
    source: "CediRates",
    unit: "GHS",
    dbSlug: "exchange-rate-ghs-usd",
    topics: ["exchange rate", "forex", "currency"],
  },
  {
    key: "GDP_GROWTH_YOY",
    source: "WorldBank",
    wbCode: "NY.GDP.MKTP.KD.ZG",
    unit: "%",
    dbSlug: "gdp-growth-rate",
    topics: ["gdp", "growth"],
  },
  {
    key: "UNEMPLOYMENT",
    source: "WorldBank",
    wbCode: "SL.UEM.TOTL.ZS",
    unit: "%",
    dbSlug: "unemployment-rate",
    topics: ["unemployment", "labour", "labor"],
  },
] as const;

// ── BoG pages to scan ─────────────────────────────────────────────────────
const BOG_PAGES = [
  "https://www.bog.gov.gh",
  "https://www.bog.gov.gh/press-release",
  "https://www.bog.gov.gh/news",
  "https://www.bog.gov.gh/monetary-policy-committee",
  "https://www.bog.gov.gh/publications",
];

// ── Qualifying topic keywords ─────────────────────────────────────────────
const TOPIC_KEYWORDS = [
  "inflation", "cpi", "monetary policy", "policy rate", "interest rate",
  "mpc", "exchange rate", "forex", "reserves", "balance of payments",
  "credit", "money supply", "m2", "fiscal", "debt", "bond",
  "treasury bill", "banking sector", "financial stability", "gdp", "growth",
  "unemployment", "labour", "labor",
];

// ── Non-qualifying patterns ───────────────────────────────────────────────
const NON_QUALIFYING_PATTERNS = [
  /^(meeting|conference|workshop|seminar)\s+(notice|schedule|invitation)/i,
  /^(season|holiday|festive)\s+greetings?/i,
  /^appointment\s+of/i,
  /^(calendar|schedule)\s+(of|for)/i,
];

// ── Helpers ───────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "StatsGH-BoGScanner/1.0" },
    });
    if (!res.ok) {
      console.log(`Skipping ${url}: HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`Failed to fetch ${url}:`, e);
    return null;
  }
}

function extractArticleLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  // Match anchor tags with href
  const regex = /<a[^>]+href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    // Only same-domain links
    if (href.startsWith("/")) {
      href = `https://www.bog.gov.gh${href}`;
    }
    if (!href.startsWith("https://www.bog.gov.gh")) continue;
    // Skip non-article patterns
    if (href.match(/\.(pdf|jpg|png|xlsx|csv|zip)$/i)) continue;
    if (href === "https://www.bog.gov.gh" || href === "https://www.bog.gov.gh/") continue;
    // Must look like an article path (has at least 2 path segments)
    const path = new URL(href).pathname;
    if (path.split("/").filter(Boolean).length < 2) continue;
    if (!seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
  }
  return links.slice(0, 20); // Limit per page to avoid excessive fetching
}

function extractTitle(html: string): string {
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogTitle) return ogTitle[1].trim();
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim();
  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (title) return title[1].trim();
  return "Untitled";
}

function extractDate(html: string): string | null {
  // Look for time element
  const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/i);
  if (timeMatch) return timeMatch[1];
  // Look for meta date
  const metaDate = html.match(/<meta[^>]*(?:name|property)="(?:article:published_time|date|pubdate)"[^>]*content="([^"]+)"/i);
  if (metaDate) return metaDate[1];
  // Look for common date patterns in text
  const datePattern = html.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (datePattern) return `${datePattern[3]}-${monthToNum(datePattern[2])}-${datePattern[1].padStart(2, "0")}`;
  return null;
}

function monthToNum(m: string): string {
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };
  return months[m.toLowerCase()] || "01";
}

function extractMainText(html: string): string {
  // Try article body
  let body = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|article-body|content-area)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || "";
  // Strip tags
  return body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 5000);
}

function detectTopics(text: string): string[] {
  const lower = text.toLowerCase();
  return TOPIC_KEYWORDS.filter((kw) => lower.includes(kw));
}

function isDateOnlyNotice(text: string, title: string): boolean {
  for (const pattern of NON_QUALIFYING_PATTERNS) {
    if (pattern.test(title)) return true;
  }
  // If body is very short and has no data keywords
  if (text.length < 100) return true;
  return false;
}

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Data fetchers (FREE, no API key) ──────────────────────────────────────

async function fetchWorldBankLatest(wbCode: string): Promise<{ value: number; period: string } | null> {
  try {
    const url = `${WORLD_BANK_BASE}/${wbCode}?format=json&per_page=5&date=2020:2026&MRV=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1]) || data[1].length === 0) return null;
    const latest = data[1][0];
    if (latest.value === null) return null;
    return { value: parseFloat(latest.value), period: latest.date };
  } catch (e) {
    console.warn(`World Bank fetch failed for ${wbCode}:`, e);
    return null;
  }
}

async function fetchFromDB(supabase: ReturnType<typeof createClient>, dbSlug: string): Promise<{ value: number; period: string } | null> {
  try {
    // Get latest data point for this indicator from our own DB
    const { data, error } = await supabase
      .from("data_points")
      .select(`
        value, date,
        data_series!inner(
          indicator_id, is_primary,
          indicators!inner(slug),
          geographies!inner(is_ghana)
        )
      `)
      .eq("data_series.indicators.slug", dbSlug)
      .eq("data_series.is_primary", true)
      .eq("data_series.geographies.is_ghana", true)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return { value: data.value, period: data.date };
  } catch (e) {
    console.warn(`DB fetch failed for ${dbSlug}:`, e);
    return null;
  }
}

// ── Topic → Indicator mapping ─────────────────────────────────────────────

function chooseIndicatorsFromTopics(allTopics: string[]): typeof INDICATORS[number][] {
  const topicSet = new Set(allTopics.map((t) => t.toLowerCase()));
  return INDICATORS.filter((ind) =>
    ind.topics.some((t) => topicSet.has(t))
  );
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create run record
    const { data: run, error: runErr } = await supabase
      .from("bog_scan_runs")
      .insert({ status: "running" })
      .select("id")
      .single();

    if (runErr || !run) {
      throw new Error(`Failed to create run: ${runErr?.message}`);
    }
    const runId = run.id;

    console.log(`BoG scan started: run ${runId}`);

    // ── Phase 1: Scan BoG pages ───────────────────────────────────────────
    const qualifyingItems: Array<{ title: string; url: string; topics: string[] }> = [];
    let totalScanned = 0;

    for (const pageUrl of BOG_PAGES) {
      const pageHtml = await fetchPage(pageUrl);
      if (!pageHtml) continue;

      const links = extractArticleLinks(pageHtml, pageUrl);
      console.log(`Found ${links.length} links on ${pageUrl}`);

      for (const link of links) {
        const articleHtml = await fetchPage(link);
        if (!articleHtml) continue;

        const title = extractTitle(articleHtml);
        const publishedDate = extractDate(articleHtml) || "unknown";
        const text = extractMainText(articleHtml);
        const topics = detectTopics(text);
        const qualifies = topics.length > 0 && !isDateOnlyNotice(text, title);
        const reason = qualifies ? "TOPIC_MATCH" : "NO_SUBSTANTIVE_DATA_SIGNAL";

        const hashInput = `${title.toLowerCase().trim()}|${publishedDate}|${[...topics].sort().join(",")}`;
        const dedupeHash = await hashString(hashInput);

        // Check dedupe
        const { data: existing } = await supabase
          .from("bog_scan_items")
          .select("id")
          .eq("dedupe_hash", dedupeHash)
          .eq("qualifies", true)
          .maybeSingle();

        if (existing) {
          console.log(`Skipping duplicate: ${title}`);
          continue;
        }

        // Insert (use upsert on dedupe_hash to handle race conditions)
        await supabase.from("bog_scan_items").upsert(
          {
            run_id: runId,
            bog_url: link,
            title,
            published_date: publishedDate,
            detected_topics: topics,
            qualifies,
            reason,
            dedupe_hash: dedupeHash,
          },
          { onConflict: "dedupe_hash" }
        );

        totalScanned++;

        if (qualifies) {
          qualifyingItems.push({ title, url: link, topics });
        }
      }
    }

    console.log(`Scanned ${totalScanned} items, ${qualifyingItems.length} qualifying`);

    // ── Phase 2: If nothing qualifies, stop ───────────────────────────────
    if (qualifyingItems.length === 0) {
      await supabase
        .from("bog_scan_runs")
        .update({
          status: "done",
          notes: "No qualifying BoG signals detected",
          items_scanned: totalScanned,
          items_qualifying: 0,
          indicators_refreshed: 0,
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({ success: true, message: "No qualifying signals", runId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Phase 3: Refresh indicators from free sources ─────────────────────
    const allTopics = qualifyingItems.flatMap((item) => item.topics);
    const indicatorsToRefresh = chooseIndicatorsFromTopics(allTopics);
    let refreshedCount = 0;
    const refreshDetails: string[] = [];

    for (const indicator of indicatorsToRefresh) {
      let result: { value: number; period: string } | null = null;

      if (indicator.source === "WorldBank" && "wbCode" in indicator) {
        result = await fetchWorldBankLatest(indicator.wbCode!);
        if (!result) {
          // Fallback: try our own DB
          result = await fetchFromDB(supabase, indicator.dbSlug);
        }
      } else if (indicator.source === "CediRates") {
        // For CediRates indicators, read latest from our own DB
        // (populated by the existing cedirates-sync function)
        result = await fetchFromDB(supabase, indicator.dbSlug);
      }

      if (result) {
        const { error: upsertErr } = await supabase
          .from("dashboard_updates")
          .upsert(
            {
              run_id: runId,
              indicator_key: indicator.key,
              period: result.period,
              value: result.value,
              unit: indicator.unit,
              source: indicator.source,
              source_detail: indicator.source === "WorldBank" 
                ? `WorldBank API ${indicator.wbCode}` 
                : `DB (cedirates-sync)`,
              updated_at_utc: new Date().toISOString(),
            },
            { onConflict: "indicator_key,period" }
          );

        if (!upsertErr) {
          refreshedCount++;
          refreshDetails.push(`${indicator.key}=${result.value} (${result.period})`);
          console.log(`Updated ${indicator.key}: ${result.value} for ${result.period}`);
        } else {
          console.warn(`Upsert failed for ${indicator.key}:`, upsertErr);
        }

        // Also update the main data_points table via existing series
        await updateMainDataPoints(supabase, indicator.dbSlug, result);
      }
    }

    const notes = refreshedCount > 0
      ? `Updated ${refreshedCount} indicators: ${refreshDetails.join(", ")}`
      : `${qualifyingItems.length} qualifying signals but no fresh data available`;

    await supabase
      .from("bog_scan_runs")
      .update({
        status: "done",
        notes,
        items_scanned: totalScanned,
        items_qualifying: qualifyingItems.length,
        indicators_refreshed: refreshedCount,
      })
      .eq("id", runId);

    const duration = Date.now() - startTime;
    console.log(`BoG scan completed in ${duration}ms. ${notes}`);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        itemsScanned: totalScanned,
        itemsQualifying: qualifyingItems.length,
        indicatorsRefreshed: refreshedCount,
        details: refreshDetails,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("BoG scan error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Update main data_points table ─────────────────────────────────────────

async function updateMainDataPoints(
  supabase: ReturnType<typeof createClient>,
  dbSlug: string,
  result: { value: number; period: string }
) {
  try {
    // Find the primary series for this indicator + Ghana
    const { data: series } = await supabase
      .from("data_series")
      .select(`
        id,
        indicators!inner(slug),
        geographies!inner(is_ghana)
      `)
      .eq("indicators.slug", dbSlug)
      .eq("is_primary", true)
      .eq("geographies.is_ghana", true)
      .maybeSingle();

    if (!series) return;

    // Upsert the data point
    await supabase
      .from("data_points")
      .upsert(
        {
          series_id: series.id,
          date: result.period.length === 4 ? `${result.period}-01-01` : result.period,
          value: result.value,
        },
        { onConflict: "series_id,date" }
      );
  } catch (e) {
    console.warn(`Failed to update main data_points for ${dbSlug}:`, e);
  }
}
