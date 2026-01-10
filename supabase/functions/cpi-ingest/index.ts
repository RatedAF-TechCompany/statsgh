import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INDICATOR_SLUG = "cpi-inflation-yoy";

// Parse month format (2024M01) to ISO date (2024-01-01)
function parseMonth(monthStr: string): string {
  const match = monthStr.match(/^(\d{4})M(\d{2})$/);
  if (!match) throw new Error(`Invalid month format: ${monthStr}`);
  return `${match[1]}-${match[2]}-01`;
}

interface CPIDataPoint {
  date: string;
  value: number;
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
    const { action, rawData } = body as { 
      action: "processData";
      rawData: { key: string[]; values: string[] }[];
    };
    
    if (action !== "processData" || !rawData || !Array.isArray(rawData)) {
      throw new Error("Invalid request: expected action='processData' with rawData array");
    }
    
    console.log(`CPI Ingest: Processing ${rawData.length} data rows from client`);
    
    // Create ingestion run record
    const { data: runData, error: runError } = await supabase
      .from("ingestion_runs")
      .insert({
        indicator_slug: INDICATOR_SLUG,
        run_type: "backfill",
        status: "running",
      })
      .select()
      .single();
    
    if (runError) {
      console.error("Failed to create ingestion run:", runError);
    } else {
      ingestionRunId = runData.id;
    }
    
    // Parse raw PxWeb data
    const cpiData: CPIDataPoint[] = [];
    
    for (const row of rawData) {
      const monthStr = row.key[0]; // Month is first dimension
      const rawValue = row.values[0];
      
      if (!rawValue || rawValue === ".." || rawValue === "-" || rawValue === "...") {
        continue;
      }
      
      const value = parseFloat(rawValue);
      if (isNaN(value)) continue;
      
      try {
        cpiData.push({
          date: parseMonth(monthStr),
          value,
        });
      } catch (e) {
        console.warn(`Skipping invalid date: ${monthStr}`);
      }
    }
    
    // Sort by date ascending
    cpiData.sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`Parsed ${cpiData.length} valid data points`);
    
    if (cpiData.length === 0) {
      throw new Error("No valid data points found in provided data");
    }
    
    const timeRange = {
      earliest: cpiData[0].date,
      latest: cpiData[cpiData.length - 1].date,
    };
    
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
    const { data: ghanaGeo } = await supabase
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
            table: "Macroeconomic Indicators/Prices and Inflation/cpi.px",
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
    const dataPoints = cpiData.map(dp => ({
      series_id: series!.id,
      date: dp.date,
      value: dp.value,
      source_id: gssSource?.id,
      value_formatted: `${dp.value.toFixed(1)}%`,
      revision_note: "Historical backfill from GSS StatsBank",
    }));
    
    console.log(`Upserting ${dataPoints.length} data points...`);
    
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
        message: "CPI backfill completed successfully",
        stats: {
          totalProcessed: cpiData.length,
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
