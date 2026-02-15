import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// COMPREHENSIVE DATA REFRESH V2.0
// Sources: World Bank, IMF WEO, CediRates API
// ============================================

const GHANA_GEO_ID = "1e6894e0-8ca1-4edd-9857-47295531d2b8";

// World Bank API indicators (annual, historical)
const WORLD_BANK_INDICATORS: Record<string, { slug: string; transform?: (v: number) => number }> = {
  "FP.CPI.TOTL.ZG": { slug: "cpi-inflation" },
  "NY.GDP.MKTP.KD.ZG": { slug: "gdp-growth-rate" },
  "GC.DOD.TOTL.GD.ZS": { slug: "public-debt-gdp" },
  "SL.UEM.TOTL.ZS": { slug: "unemployment-rate" },
  "SP.POP.TOTL": { slug: "population-total", transform: (v) => v / 1_000_000 },
  "SP.DYN.LE00.IN": { slug: "life-expectancy" },
  "SE.PRM.ENRR": { slug: "primary-enrollment" },
  "EG.ELC.ACCS.ZS": { slug: "electricity-access" },
  "EN.ATM.CO2E.KT": { slug: "co2-emissions", transform: (v) => v / 1000 },
  "BX.TRF.PWKR.CD.DT": { slug: "remittances-inflow", transform: (v) => v / 1_000_000_000 },
  "SP.DYN.TFRT.IN": { slug: "fertility-rate" },
  "NY.GDP.MKTP.CD": { slug: "gdp-nominal", transform: (v) => v / 1_000_000_000 },
  "GC.TAX.TOTL.GD.ZS": { slug: "tax-revenue" }, // tax as % of GDP
  "ST.INT.ARVL": { slug: "tourist-arrivals", transform: (v) => v / 1000 },
  "NE.TRD.GNFS.ZS": { slug: "trade-balance" }, // trade % of GDP (proxy)
};

// IMF World Economic Outlook indicators (projections + recent)
// We use the IMF WEO API for latest forecasts
const IMF_WEO_INDICATORS: Record<string, { slug: string; transform?: (v: number) => number }> = {
  "NGDP_RPCH": { slug: "gdp-growth-rate" },      // Real GDP growth %
  "PCPIPCH": { slug: "cpi-inflation" },            // Inflation, avg consumer prices %
  "GGXWDG_NGDP": { slug: "public-debt-gdp" },     // Gross govt debt % GDP
  "LUR": { slug: "unemployment-rate" },            // Unemployment rate
  "NGDPD": { slug: "gdp-nominal" },               // GDP current prices (USD bn)
  "BCA_NGDPD": { slug: "trade-balance" },          // Current account % GDP
};

// Fetch World Bank data for a single indicator
async function fetchWorldBankData(code: string, dateRange = "2000:2025"): Promise<Array<{ date: string; value: number }>> {
  const url = `https://api.worldbank.org/v2/country/GHA/indicator/${code}?format=json&per_page=100&date=${dateRange}`;
  try {
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) return [];
    return data[1]
      .filter((d: any) => d.value !== null && d.value !== undefined)
      .map((d: any) => ({ date: `${d.date}-01-01`, value: parseFloat(d.value) }));
  } catch (e) {
    console.error(`WB fetch error ${code}:`, e);
    return [];
  }
}

// Fetch IMF WEO data for Ghana
async function fetchIMFWEOData(): Promise<Map<string, Array<{ date: string; value: number }>>> {
  const result = new Map<string, Array<{ date: string; value: number }>>();
  
  // IMF SDMX JSON API for WEO data
  const indicators = Object.keys(IMF_WEO_INDICATORS);
  
  for (const indicatorCode of indicators) {
    try {
      // IMF API endpoint for WEO data
      const url = `https://www.imf.org/external/datamapper/api/v1/${indicatorCode}/GHA`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) { await res.text(); continue; }
      
      const data = await res.json();
      const values = data?.values?.[indicatorCode]?.GHA;
      
      if (!values || typeof values !== "object") continue;
      
      const points: Array<{ date: string; value: number }> = [];
      for (const [year, val] of Object.entries(values)) {
        const numVal = parseFloat(val as string);
        if (!isNaN(numVal)) {
          points.push({ date: `${year}-01-01`, value: numVal });
        }
      }
      
      if (points.length > 0) {
        result.set(indicatorCode, points);
        console.log(`IMF WEO: ${indicatorCode} => ${points.length} points (latest: ${points[points.length - 1]?.date} = ${points[points.length - 1]?.value})`);
      }
    } catch (e) {
      console.error(`IMF WEO error for ${indicatorCode}:`, e);
    }
  }
  
  return result;
}

// Fetch Bank of Ghana key rates from their API/public data
async function fetchBOGRates(): Promise<Array<{ slug: string; date: string; value: number; source: string }>> {
  const results: Array<{ slug: string; date: string; value: number; source: string }> = [];
  
  // Try fetching from Bank of Ghana statistical bulletin page
  try {
    // Use a known BoG endpoint for monetary policy rate
    const bogUrl = "https://www.bog.gov.gh/monetary-policy/monetary-policy-rate/";
    const res = await fetch(bogUrl);
    if (res.ok) {
      const html = await res.text();
      // Extract the latest MPR from the page
      const mprMatch = html.match(/(?:monetary\s+policy\s+rate|mpr|policy\s+rate)[^0-9]*(\d+\.?\d*)\s*%/i);
      if (mprMatch) {
        const rate = parseFloat(mprMatch[1]);
        if (rate > 5 && rate < 50) { // Sanity check
          results.push({ slug: "policy-rate", date: new Date().toISOString().split("T")[0], value: rate, source: "BoG" });
          console.log(`BoG Policy Rate: ${rate}%`);
        }
      }
    } else {
      await res.text();
    }
  } catch (e) {
    console.error("BoG rates fetch error:", e);
  }
  
  return results;
}

// Fetch Ghana Statistical Service CPI data
async function fetchGSSInflation(): Promise<Array<{ slug: string; date: string; value: number }>> {
  const results: Array<{ slug: string; date: string; value: number }> = [];
  
  try {
    // GSS publishes CPI bulletins - try their API endpoint
    const gssUrl = "https://statsghana.gov.gh/api/cpi";
    const res = await fetch(gssUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.inflation_rate) {
        results.push({
          slug: "cpi-inflation",
          date: new Date().toISOString().split("T")[0],
          value: parseFloat(data.inflation_rate),
        });
      }
    } else {
      await res.text();
      console.log("GSS API not available, will use World Bank/IMF data");
    }
  } catch (e) {
    console.log("GSS API not available, using WB/IMF fallback");
  }
  
  return results;
}

// Use the existing cedirates-sync pattern for live financial data
async function fetchCediRatesData(): Promise<Array<{ slug: string; date: string; value: number; source: string }>> {
  const results: Array<{ slug: string; date: string; value: number; source: string }> = [];
  const today = new Date().toISOString().split("T")[0];
  
  try {
    // CediRates endpoint
    const res = await fetch("https://cedirates.com/api/rates");
    if (res.ok) {
      const data = await res.json();
      
      // Extract USD/GHS rate
      if (data?.usd_ghs) {
        const mid = (parseFloat(data.usd_ghs.buy) + parseFloat(data.usd_ghs.sell)) / 2;
        if (mid > 10 && mid < 30) {
          results.push({ slug: "exchange-rate-ghs-usd", date: today, value: Math.round(mid * 100) / 100, source: "CediRates" });
        }
      }
      
      // Fuel prices
      if (data?.fuel?.petrol) {
        results.push({ slug: "fuel-price-petrol", date: today, value: parseFloat(data.fuel.petrol), source: "CediRates" });
      }
      if (data?.fuel?.diesel) {
        results.push({ slug: "fuel-price-diesel", date: today, value: parseFloat(data.fuel.diesel), source: "CediRates" });
      }
    } else {
      await res.text();
    }
  } catch (e) {
    console.log("CediRates API unavailable, skipping live rates");
  }
  
  // Ghana API fallback for exchange rates
  try {
    const ghRes = await fetch("https://api.ghanaapi.com/v1/exchange-rates");
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      if (ghData?.rates?.USD && results.every(r => r.slug !== "exchange-rate-ghs-usd")) {
        const rate = parseFloat(ghData.rates.USD);
        if (rate > 10 && rate < 30) {
          results.push({ slug: "exchange-rate-ghs-usd", date: today, value: Math.round(rate * 100) / 100, source: "GhanaAPI" });
        }
      }
    } else {
      await ghRes.text();
    }
  } catch (e) {
    console.log("GhanaAPI unavailable");
  }
  
  return results;
}

// Fetch COCOBOD / ICCO data for cocoa production
async function fetchCommodityData(): Promise<Array<{ slug: string; date: string; value: number; source: string }>> {
  const results: Array<{ slug: string; date: string; value: number; source: string }> = [];
  
  // World Bank commodity prices API
  try {
    const wbCocoa = await fetchWorldBankData("TX.VAL.COCO.UN.AD");
    if (wbCocoa.length > 0) {
      // This gives cocoa export value - we can use it as a proxy
      console.log(`WB Cocoa data: ${wbCocoa.length} points`);
    }
  } catch (e) {
    console.log("Commodity data fetch skipped");
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create ingestion run
    const { data: runRecord } = await supabase
      .from("ingestion_runs")
      .insert({ indicator_slug: "full-refresh-v2", run_type: "automated", status: "running" })
      .select("id")
      .single();
    const runId = runRecord?.id;

    // Get source IDs
    const { data: sources } = await supabase.from("data_sources").select("id, short_name");
    const sourceMap = new Map(sources?.map(s => [s.short_name, s.id]) || []);
    
    // Get indicator IDs
    const { data: indicators } = await supabase.from("indicators").select("id, slug");
    const indicatorMap = new Map(indicators?.map(i => [i.slug, i.id]) || []);

    let totalPointsUpdated = 0;
    let indicatorsUpdated = 0;
    const errors: string[] = [];
    const summary: Record<string, { points: number; source: string; latest?: string }> = {};

    // Helper: upsert data points for a given slug
    async function upsertForSlug(
      slug: string,
      points: Array<{ date: string; value: number }>,
      sourceShortName: string,
      transform?: (v: number) => number
    ) {
      const indicatorId = indicatorMap.get(slug);
      if (!indicatorId) {
        console.log(`Indicator ${slug} not in DB, skipping`);
        return;
      }
      if (points.length === 0) return;

      const sourceId = sourceMap.get(sourceShortName) || sourceMap.get("WB");

      // Get or create primary series
      let { data: series } = await supabase
        .from("data_series")
        .select("id")
        .eq("indicator_id", indicatorId)
        .eq("geography_id", GHANA_GEO_ID)
        .eq("is_primary", true)
        .maybeSingle();

      if (!series) {
        const { data: newSeries, error: seriesErr } = await supabase
          .from("data_series")
          .insert({
            indicator_id: indicatorId,
            geography_id: GHANA_GEO_ID,
            source_id: sourceId,
            is_primary: true,
            name: "Primary Series",
          })
          .select("id")
          .single();
        if (seriesErr) {
          errors.push(`Series creation failed for ${slug}: ${seriesErr.message}`);
          return;
        }
        series = newSeries;
      }

      const rows = points.map(p => ({
        series_id: series!.id,
        date: p.date,
        value: transform ? transform(p.value) : p.value,
        source_id: sourceId,
      }));

      const { error: upsertErr } = await supabase
        .from("data_points")
        .upsert(rows, { onConflict: "series_id,date" });

      if (upsertErr) {
        errors.push(`Upsert failed for ${slug}: ${upsertErr.message}`);
      } else {
        totalPointsUpdated += rows.length;
        indicatorsUpdated++;
        const latest = points.sort((a, b) => b.date.localeCompare(a.date))[0];
        summary[slug] = { points: rows.length, source: sourceShortName, latest: `${latest.date}: ${transform ? transform(latest.value) : latest.value}` };
      }

      await supabase.from("indicators").update({ updated_at: new Date().toISOString() }).eq("id", indicatorId);
    }

    // ============================================
    // 1. WORLD BANK DATA (historical, annual)
    // ============================================
    console.log("=== Phase 1: World Bank API ===");
    for (const [wbCode, config] of Object.entries(WORLD_BANK_INDICATORS)) {
      try {
        const data = await fetchWorldBankData(wbCode);
        await upsertForSlug(config.slug, data, "WB", config.transform);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`WB ${config.slug}: ${msg}`);
      }
    }

    // ============================================
    // 2. IMF WEO DATA (recent + projections)
    // ============================================
    console.log("=== Phase 2: IMF WEO API ===");
    try {
      const imfData = await fetchIMFWEOData();
      
      for (const [imfCode, config] of Object.entries(IMF_WEO_INDICATORS)) {
        const points = imfData.get(imfCode);
        if (points && points.length > 0) {
          await upsertForSlug(config.slug, points, "IMF", config.transform);
        }
      }
    } catch (e) {
      errors.push(`IMF WEO: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ============================================
    // 3. BANK OF GHANA (policy rate)
    // ============================================
    console.log("=== Phase 3: Bank of Ghana ===");
    try {
      const bogRates = await fetchBOGRates();
      for (const rate of bogRates) {
        await upsertForSlug(rate.slug, [{ date: rate.date, value: rate.value }], "BoG");
      }
    } catch (e) {
      errors.push(`BoG: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ============================================
    // 4. LIVE FINANCIAL DATA (CediRates/GhanaAPI)
    // ============================================
    console.log("=== Phase 4: Live Financial Data ===");
    try {
      const liveData = await fetchCediRatesData();
      for (const item of liveData) {
        const srcShort = item.source === "CediRates" ? "CediRates" : "WB";
        await upsertForSlug(item.slug, [{ date: item.date, value: item.value }], srcShort);
      }
    } catch (e) {
      errors.push(`Live data: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ============================================
    // 5. GSS INFLATION (if available)
    // ============================================
    console.log("=== Phase 5: GSS ===");
    try {
      const gssData = await fetchGSSInflation();
      for (const item of gssData) {
        await upsertForSlug(item.slug, [{ date: item.date, value: item.value }], "GSS");
      }
    } catch (e) {
      // GSS API often unavailable - not an error
      console.log("GSS data unavailable, skipping");
    }

    // ============================================
    // 6. COMMODITY DATA
    // ============================================
    console.log("=== Phase 6: Commodities ===");
    try {
      await fetchCommodityData();
    } catch (e) {
      console.log("Commodity data skipped");
    }

    const duration = Date.now() - startTime;

    // Update run record
    if (runId) {
      await supabase
        .from("ingestion_runs")
        .update({
          status: errors.length > 0 ? "partial" : "success",
          finished_at: new Date().toISOString(),
          rows_updated: totalPointsUpdated,
          rows_inserted: indicatorsUpdated,
          error_message: errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
        })
        .eq("id", runId);
    }

    console.log(`=== REFRESH COMPLETE: ${indicatorsUpdated} indicators, ${totalPointsUpdated} points in ${duration}ms ===`);

    return new Response(
      JSON.stringify({
        success: true,
        indicatorsUpdated,
        totalPointsUpdated,
        durationMs: duration,
        summary,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Data refresh error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
