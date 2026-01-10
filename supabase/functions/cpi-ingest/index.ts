import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDICATOR_SLUG = "cpi-inflation-yoy";

// PxWeb configuration for CPI inflation
const CPI_PXWEB_CONFIG = {
  baseUrl: "https://statsbank.statsghana.gov.gh/api/v1/en/",
  tablePath: "Macroeconomic%20Indicators/Prices%20and%20Inflation/cpi.px",
  dimensions: {
    time: "Month",
    indicator: "Indicator",
    geography: "Region",
    product: "Product",
    source: "Source",
  },
  fixedSelections: {
    Indicator: ["Year-on-year inflation (%)"],
    Region: ["Ghana"],
    Product: ["All products"],
    Source: ["All sources"],
  },
  geographyMapping: {
    Ghana: { name: "Ghana", type: "national" },
  },
};

interface PxWebVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
}

interface PxWebMetadata {
  title: string;
  variables: PxWebVariable[];
}

interface PxWebDataResponse {
  columns: { code: string; text: string; type: string }[];
  data: { key: string[]; values: string[] }[];
}

// Parse month format (2024M01) to ISO date (2024-01-01)
function parseMonth(monthStr: string): string {
  const match = monthStr.match(/^(\d{4})M(\d{2})$/);
  if (!match) throw new Error(`Invalid month format: ${monthStr}`);
  return `${match[1]}-${match[2]}-01`;
}

// Fetch data from PxWeb API
async function fetchCPIData(latestOnly: boolean = false): Promise<{
  data: { date: string; value: number | null }[];
  timeRange: { earliest: string; latest: string } | null;
}> {
  const url = `${CPI_PXWEB_CONFIG.baseUrl}${CPI_PXWEB_CONFIG.tablePath}`;
  
  // First, fetch metadata to get available time periods
  console.log(`Fetching metadata from: ${url}`);
  const metaResponse = await fetch(url);
  if (!metaResponse.ok) {
    throw new Error(`Failed to fetch metadata: ${metaResponse.status}`);
  }
  
  const metadata: PxWebMetadata = await metaResponse.json();
  const timeVariable = metadata.variables.find(v => v.code === "Month");
  if (!timeVariable) {
    throw new Error("Could not find Month variable in metadata");
  }
  
  const timeValues = latestOnly ? [timeVariable.values[0]] : timeVariable.values;
  
  // Build query
  const query = metadata.variables.map(variable => {
    let values: string[];
    
    if (variable.code === "Month") {
      values = timeValues;
    } else if (CPI_PXWEB_CONFIG.fixedSelections[variable.code as keyof typeof CPI_PXWEB_CONFIG.fixedSelections]) {
      values = CPI_PXWEB_CONFIG.fixedSelections[variable.code as keyof typeof CPI_PXWEB_CONFIG.fixedSelections];
    } else {
      values = [variable.values[0]];
    }
    
    return {
      code: variable.code,
      selection: { filter: "item", values },
    };
  });
  
  console.log(`Querying ${timeValues.length} time periods`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      response: { format: "json" },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query data: ${response.status} - ${errorText}`);
  }
  
  const result: PxWebDataResponse = await response.json();
  console.log(`Received ${result.data.length} data rows`);
  
  // Parse and normalize data
  const parsed: { date: string; value: number | null }[] = [];
  
  for (const row of result.data) {
    const monthStr = row.key[0]; // Month is first column
    const rawValue = row.values[0];
    
    let value: number | null = null;
    if (rawValue && rawValue !== ".." && rawValue !== "-") {
      const num = parseFloat(rawValue);
      if (!isNaN(num)) value = num;
    }
    
    try {
      parsed.push({
        date: parseMonth(monthStr),
        value,
      });
    } catch (e) {
      console.warn(`Skipping invalid date: ${monthStr}`);
    }
  }
  
  // Sort by date ascending
  parsed.sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    data: parsed,
    timeRange: parsed.length > 0 ? {
      earliest: parsed[0].date,
      latest: parsed[parsed.length - 1].date,
    } : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let ingestionRunId: string | null = null;
  
  try {
    const body = await req.json();
    const { action } = body as { action: "backfill" | "refresh" };
    
    console.log(`CPI Ingest: Action=${action}`);
    
    const isBackfill = action === "backfill";
    const runType = isBackfill ? "backfill" : "scheduled";
    
    // Create ingestion run record
    const { data: runData, error: runError } = await supabase
      .from("ingestion_runs")
      .insert({
        indicator_slug: INDICATOR_SLUG,
        run_type: runType,
        status: "running",
      })
      .select()
      .single();
    
    if (runError) {
      console.error("Failed to create ingestion run:", runError);
    } else {
      ingestionRunId = runData.id;
    }
    
    // Fetch data from PxWeb
    const { data: cpiData, timeRange } = await fetchCPIData(!isBackfill);
    
    if (cpiData.length === 0) {
      throw new Error("No data returned from PxWeb API");
    }
    
    console.log(`Fetched ${cpiData.length} data points, range: ${timeRange?.earliest} to ${timeRange?.latest}`);
    
    // Get or create the indicator
    const { data: existingIndicator } = await supabase
      .from("indicators")
      .select("id")
      .eq("slug", INDICATOR_SLUG)
      .single();
    
    let indicatorId: string;
    
    if (!existingIndicator) {
      console.log("Creating CPI indicator...");
      const { data: newIndicator, error: createError } = await supabase
        .from("indicators")
        .insert({
          slug: INDICATOR_SLUG,
          name: "Consumer Price Index Inflation (Year-on-Year)",
          short_name: "CPI Inflation YoY",
          unit: "%",
          unit_display: "%",
          description: "Year-on-year percentage change in the Consumer Price Index for Ghana",
          definition: "The Consumer Price Index (CPI) measures the average change in prices over time that consumers pay for a basket of goods and services. Year-on-year inflation compares prices in the current month to the same month in the previous year.",
          methodology: "Data sourced from Ghana Statistical Service (GSS) StatsBank. The CPI is calculated using a Laspeyres price index with 2021 as the base year.",
          frequency: "monthly",
          is_ghana_core: true,
          priority_tier: "tier1",
          chart_type: "line",
          decimal_places: 1,
        })
        .select()
        .single();
      
      if (createError || !newIndicator) throw createError || new Error("Failed to create indicator");
      indicatorId = newIndicator.id;
    } else {
      indicatorId = existingIndicator.id;
    }
    
    // Get Ghana geography
    const { data: ghanaGeo, error: geoError } = await supabase
      .from("geographies")
      .select("id")
      .eq("code", "GH")
      .single();
    
    if (!ghanaGeo) {
      throw new Error("Ghana geography not found. Please ensure geographies are set up.");
    }
    
    // Get or create GSS source
    let { data: gssSource } = await supabase
      .from("data_sources")
      .select("id")
      .eq("short_name", "GSS")
      .single();
    
    if (!gssSource) {
      const { data: newSource, error: srcError } = await supabase
        .from("data_sources")
        .insert({
          name: "Ghana Statistical Service",
          short_name: "GSS",
          source_type: "government",
          website_url: "https://statsghana.gov.gh",
          is_ghana_source: true,
          description: "Official statistical agency of Ghana",
        })
        .select()
        .single();
      
      if (srcError) console.warn("Could not create GSS source:", srcError);
      gssSource = newSource;
    }
    
    // Get or create data series
    let { data: series } = await supabase
      .from("data_series")
      .select("id")
      .eq("indicator_id", indicatorId)
      .eq("geography_id", ghanaGeo.id)
      .eq("is_primary", true)
      .single();
    
    if (!series) {
      console.log("Creating data series...");
      const { data: newSeries, error: createSeriesError } = await supabase
        .from("data_series")
        .insert({
          indicator_id: indicatorId,
          geography_id: ghanaGeo.id,
          is_primary: true,
          name: "Ghana National CPI Inflation (YoY)",
          breakdown_type: "national",
          source_id: gssSource?.id,
          external_key: JSON.stringify({
            table: CPI_PXWEB_CONFIG.tablePath,
            indicator: "Year-on-year inflation (%)",
            region: "Ghana",
            product: "All products",
          }),
        })
        .select()
        .single();
      
      if (createSeriesError) throw createSeriesError;
      series = newSeries;
    }
    
    // Prepare data points for upsert
    const dataPoints = cpiData
      .filter(dp => dp.value !== null)
      .map(dp => ({
        series_id: series!.id,
        date: dp.date,
        value: dp.value,
        source_id: gssSource?.id,
        value_formatted: `${dp.value!.toFixed(1)}%`,
        revision_note: isBackfill ? "Historical backfill from GSS StatsBank" : null,
      }));
    
    console.log(`Upserting ${dataPoints.length} valid data points...`);
    
    // Get existing data points to track updates vs inserts
    const { data: existingPoints } = await supabase
      .from("data_points")
      .select("date, value")
      .eq("series_id", series!.id);
    
    const existingMap = new Map(existingPoints?.map(p => [p.date, p.value]) || []);
    
    let rowsInserted = 0;
    let rowsUpdated = 0;
    
    for (const dp of dataPoints) {
      const existing = existingMap.get(dp.date);
      if (existing === undefined) {
        rowsInserted++;
      } else if (existing !== dp.value) {
        rowsUpdated++;
      }
    }
    
    // Upsert data points
    const { error: upsertError } = await supabase
      .from("data_points")
      .upsert(dataPoints, { 
        onConflict: "series_id,date",
        ignoreDuplicates: false,
      });
    
    if (upsertError) throw upsertError;
    
    // Update indicator's updated_at timestamp
    await supabase
      .from("indicators")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", indicatorId);
    
    // Update ingestion run as success
    if (ingestionRunId) {
      await supabase
        .from("ingestion_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          rows_inserted: rowsInserted,
          rows_updated: rowsUpdated,
        })
        .eq("id", ingestionRunId);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `CPI ${action} completed successfully`,
        stats: {
          totalFetched: cpiData.length,
          rowsInserted,
          rowsUpdated,
          timeRange,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("CPI Ingest Error:", error);
    
    // Update ingestion run as failed
    if (ingestionRunId) {
      await supabase
        .from("ingestion_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", ingestionRunId);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
