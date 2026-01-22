import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// World Bank API - Ghana country code is GHA
const WORLD_BANK_BASE = "https://api.worldbank.org/v2/country/GHA/indicator";

// Indicator mappings to World Bank codes
const WORLD_BANK_INDICATORS: Record<string, { wbCode: string; slug: string }> = {
  "FP.CPI.TOTL.ZG": { wbCode: "FP.CPI.TOTL.ZG", slug: "cpi-inflation" },
  "NY.GDP.MKTP.KD.ZG": { wbCode: "NY.GDP.MKTP.KD.ZG", slug: "gdp-growth-rate" },
  "GC.DOD.TOTL.GD.ZS": { wbCode: "GC.DOD.TOTL.GD.ZS", slug: "public-debt-gdp" },
  "SL.UEM.TOTL.ZS": { wbCode: "SL.UEM.TOTL.ZS", slug: "unemployment-rate" },
  "SP.POP.TOTL": { wbCode: "SP.POP.TOTL", slug: "population-total" },
  "SP.DYN.LE00.IN": { wbCode: "SP.DYN.LE00.IN", slug: "life-expectancy" },
  "SE.PRM.ENRR": { wbCode: "SE.PRM.ENRR", slug: "primary-enrollment" },
  "EG.ELC.ACCS.ZS": { wbCode: "EG.ELC.ACCS.ZS", slug: "electricity-access" },
  "EN.ATM.CO2E.KT": { wbCode: "EN.ATM.CO2E.KT", slug: "co2-emissions" },
  "BX.TRF.PWKR.CD.DT": { wbCode: "BX.TRF.PWKR.CD.DT", slug: "remittances-inflow" },
};

// Fetch data from World Bank API
async function fetchWorldBankData(indicatorCode: string): Promise<Array<{ date: string; value: number }>> {
  const url = `${WORLD_BANK_BASE}/${indicatorCode}?format=json&per_page=50&date=2010:2024`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`World Bank API error for ${indicatorCode}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // World Bank returns [metadata, data array]
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
      console.log(`No data from World Bank for ${indicatorCode}`);
      return [];
    }
    
    const results: Array<{ date: string; value: number }> = [];
    
    for (const item of data[1]) {
      if (item.value !== null && item.value !== undefined) {
        results.push({
          date: `${item.date}-01-01`,
          value: parseFloat(item.value),
        });
      }
    }
    
    console.log(`Fetched ${results.length} data points for ${indicatorCode}`);
    return results;
  } catch (error) {
    console.error(`Error fetching ${indicatorCode}:`, error);
    return [];
  }
}

// Fetch Bank of Ghana exchange rate data (scraping their published rates)
async function fetchBOGExchangeRates(): Promise<Array<{ date: string; value: number }>> {
  // BoG publishes rates - we'll use a proxy approach with their data
  // For now, return empty as we'd need specific API access
  console.log("BoG exchange rate fetch - using cached/manual data");
  return [];
}

// Fetch Bank of Ghana monetary policy rate
async function fetchBOGPolicyRate(): Promise<Array<{ date: string; value: number }>> {
  // BoG monetary policy decisions are published periodically
  console.log("BoG policy rate fetch - using cached/manual data");
  return [];
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

    const ghanaGeoId = "1e6894e0-8ca1-4edd-9857-47295531d2b8";
    
    // Create ingestion run record
    const { data: runRecord, error: runError } = await supabase
      .from("ingestion_runs")
      .insert({
        indicator_slug: "multi-indicator-refresh",
        run_type: "automated",
        status: "running",
      })
      .select("id")
      .single();

    if (runError) {
      console.error("Failed to create run record:", runError);
    }

    const runId = runRecord?.id;
    
    // Get source mappings
    const { data: sources } = await supabase.from("data_sources").select("id, short_name");
    const sourceMap = new Map(sources?.map(s => [s.short_name, s.id]) || []);
    const worldBankSourceId = sourceMap.get("WB");
    
    // Get indicator mappings
    const { data: indicators } = await supabase.from("indicators").select("id, slug");
    const indicatorMap = new Map(indicators?.map(i => [i.slug, i.id]) || []);
    
    let totalPointsUpdated = 0;
    let indicatorsUpdated = 0;
    const errors: string[] = [];

    // Fetch and update World Bank indicators
    for (const [wbCode, config] of Object.entries(WORLD_BANK_INDICATORS)) {
      try {
        const indicatorId = indicatorMap.get(config.slug);
        
        if (!indicatorId) {
          console.log(`Indicator ${config.slug} not found in database, skipping`);
          continue;
        }

        const data = await fetchWorldBankData(wbCode);
        
        if (data.length === 0) {
          continue;
        }

        // Get or create series
        let { data: series } = await supabase
          .from("data_series")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("geography_id", ghanaGeoId)
          .eq("is_primary", true)
          .maybeSingle();

        if (!series) {
          const { data: newSeries, error: seriesError } = await supabase
            .from("data_series")
            .insert({
              indicator_id: indicatorId,
              geography_id: ghanaGeoId,
              source_id: worldBankSourceId,
              is_primary: true,
              name: "Primary Series",
            })
            .select("id")
            .single();

          if (seriesError) {
            errors.push(`Failed to create series for ${config.slug}: ${seriesError.message}`);
            continue;
          }
          series = newSeries;
        }

        // Transform data for population (divide by 1M)
        const transformedData = data.map(d => {
          let value = d.value;
          if (config.slug === "population-total") {
            value = value / 1000000; // Convert to millions
          }
          if (config.slug === "co2-emissions") {
            value = value / 1000; // Convert kt to million tonnes
          }
          if (config.slug === "remittances-inflow") {
            value = value / 1000000000; // Convert to billions
          }
          return {
            series_id: series.id,
            date: d.date,
            value: value,
            source_id: worldBankSourceId,
          };
        });

        const { error: upsertError } = await supabase
          .from("data_points")
          .upsert(transformedData, { onConflict: "series_id,date" });

        if (upsertError) {
          errors.push(`Failed to upsert data for ${config.slug}: ${upsertError.message}`);
        } else {
          totalPointsUpdated += transformedData.length;
          indicatorsUpdated++;
          console.log(`Updated ${config.slug} with ${transformedData.length} points`);
        }

        // Update indicator's updated_at
        await supabase
          .from("indicators")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", indicatorId);

      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error processing ${config.slug}: ${msg}`);
        console.error(`Error processing ${config.slug}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    // Update ingestion run record
    if (runId) {
      await supabase
        .from("ingestion_runs")
        .update({
          status: errors.length > 0 ? "partial" : "success",
          finished_at: new Date().toISOString(),
          rows_updated: totalPointsUpdated,
          error_message: errors.length > 0 ? errors.join("; ") : null,
        })
        .eq("id", runId);
    }

    console.log(`Data refresh completed in ${duration}ms. Updated ${indicatorsUpdated} indicators with ${totalPointsUpdated} data points.`);

    return new Response(
      JSON.stringify({
        success: true,
        indicatorsUpdated,
        totalPointsUpdated,
        durationMs: duration,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Data refresh error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
