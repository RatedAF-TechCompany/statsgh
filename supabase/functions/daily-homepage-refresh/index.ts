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
  "SP.DYN.TFRT.IN": { wbCode: "SP.DYN.TFRT.IN", slug: "fertility-rate" },
};

// Fetch data from World Bank API
async function fetchWorldBankData(indicatorCode: string): Promise<Array<{ date: string; value: number }>> {
  const currentYear = new Date().getFullYear();
  const url = `${WORLD_BANK_BASE}/${indicatorCode}?format=json&per_page=50&date=2010:${currentYear}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`World Bank API error for ${indicatorCode}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
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

// Fetch exchange rates from Ghana API
async function fetchExchangeRates(): Promise<{ usd: number | null }> {
  try {
    const response = await fetch("https://api.ghana-api.dev/api/v1/exchange-rates/current?currencies=USD", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "StatsGH/1.0",
      },
    });

    if (!response.ok) {
      console.log("Ghana API exchange rates unavailable:", response.status);
      return { usd: null };
    }

    const data = await response.json();
    
    if (data.data?.USD) {
      const mid = (data.data.USD.buying + data.data.USD.selling) / 2;
      console.log(`Fetched USD/GHS rate: ${mid}`);
      return { usd: mid };
    }

    return { usd: null };
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return { usd: null };
  }
}

// Fetch fuel prices from Ghana API
async function fetchFuelPrices(): Promise<{ petrol: number | null; diesel: number | null }> {
  try {
    const response = await fetch("https://api.ghana-api.dev/api/v1/transport/fuel-prices", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "StatsGH/1.0",
      },
    });

    if (!response.ok) {
      console.log("Ghana API fuel prices unavailable:", response.status);
      return { petrol: null, diesel: null };
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      let totalPetrol = 0, petrolCount = 0;
      let totalDiesel = 0, dieselCount = 0;

      for (const omc of data.data) {
        if (omc.petrol && omc.petrol > 0) {
          totalPetrol += omc.petrol;
          petrolCount++;
        }
        if (omc.diesel && omc.diesel > 0) {
          totalDiesel += omc.diesel;
          dieselCount++;
        }
      }

      return {
        petrol: petrolCount > 0 ? totalPetrol / petrolCount : null,
        diesel: dieselCount > 0 ? totalDiesel / dieselCount : null,
      };
    }

    return { petrol: null, diesel: null };
  } catch (error) {
    console.error("Error fetching fuel prices:", error);
    return { petrol: null, diesel: null };
  }
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

    console.log("Starting daily homepage data refresh at", new Date().toISOString());

    // Get Ghana geography ID
    const { data: ghana } = await supabase
      .from("geographies")
      .select("id")
      .eq("name", "Ghana")
      .eq("type", "country")
      .single();

    if (!ghana) {
      throw new Error("Ghana geography not found");
    }

    // Get source mappings
    const { data: sources } = await supabase.from("data_sources").select("id, short_name");
    const sourceMap = new Map(sources?.map(s => [s.short_name, s.id]) || []);
    const worldBankSourceId = sourceMap.get("WB");
    const cediRatesSourceId = sourceMap.get("CediRates");
    
    // Get indicator mappings
    const { data: indicators } = await supabase.from("indicators").select("id, slug");
    const indicatorMap = new Map(indicators?.map(i => [i.slug, i.id]) || []);
    
    // Create ingestion run record
    const { data: runRecord } = await supabase
      .from("ingestion_runs")
      .insert({
        indicator_slug: "daily-homepage-refresh",
        run_type: "scheduled",
        status: "running",
      })
      .select("id")
      .single();

    const runId = runRecord?.id;
    
    let totalPointsUpdated = 0;
    const errors: string[] = [];
    const today = new Date().toISOString().split("T")[0];

    // 1. Fetch and update World Bank indicators
    console.log("Refreshing World Bank indicators...");
    for (const [wbCode, config] of Object.entries(WORLD_BANK_INDICATORS)) {
      try {
        const indicatorId = indicatorMap.get(config.slug);
        
        if (!indicatorId) {
          console.log(`Indicator ${config.slug} not found, skipping`);
          continue;
        }

        const data = await fetchWorldBankData(wbCode);
        
        if (data.length === 0) continue;

        // Get or create series
        let { data: series } = await supabase
          .from("data_series")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("geography_id", ghana.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (!series) {
          const { data: newSeries, error: seriesError } = await supabase
            .from("data_series")
            .insert({
              indicator_id: indicatorId,
              geography_id: ghana.id,
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

        // Transform data for specific indicators
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
          errors.push(`Failed to upsert ${config.slug}: ${upsertError.message}`);
        } else {
          totalPointsUpdated += transformedData.length;
          console.log(`Updated ${config.slug} with ${transformedData.length} points`);
        }

        // Update indicator timestamp
        await supabase
          .from("indicators")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", indicatorId);

      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error processing ${config.slug}: ${msg}`);
      }
    }

    // 2. Fetch and update exchange rates
    console.log("Refreshing exchange rates...");
    const exchangeRates = await fetchExchangeRates();
    if (exchangeRates.usd && exchangeRates.usd > 10) {
      const indicatorId = indicatorMap.get("exchange-rate-ghs-usd");
      if (indicatorId) {
        let { data: series } = await supabase
          .from("data_series")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("geography_id", ghana.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (!series) {
          const { data: newSeries } = await supabase
            .from("data_series")
            .insert({
              indicator_id: indicatorId,
              geography_id: ghana.id,
              source_id: cediRatesSourceId,
              is_primary: true,
            })
            .select("id")
            .single();
          series = newSeries;
        }

        if (series) {
          const { error } = await supabase.from("data_points").upsert(
            { series_id: series.id, date: today, value: exchangeRates.usd },
            { onConflict: "series_id,date" }
          );

          if (!error) {
            totalPointsUpdated++;
            console.log(`Updated USD/GHS rate: ${exchangeRates.usd}`);
          } else {
            errors.push(`Exchange rate error: ${error.message}`);
          }

          await supabase
            .from("indicators")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", indicatorId);
        }
      }
    }

    // 3. Fetch and update fuel prices
    console.log("Refreshing fuel prices...");
    const fuelPrices = await fetchFuelPrices();
    if (fuelPrices.petrol) {
      const indicatorId = indicatorMap.get("fuel-price-petrol");
      if (indicatorId) {
        let { data: series } = await supabase
          .from("data_series")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("geography_id", ghana.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (!series) {
          const { data: newSeries } = await supabase
            .from("data_series")
            .insert({
              indicator_id: indicatorId,
              geography_id: ghana.id,
              source_id: cediRatesSourceId,
              is_primary: true,
            })
            .select("id")
            .single();
          series = newSeries;
        }

        if (series) {
          const { error } = await supabase.from("data_points").upsert(
            { series_id: series.id, date: today, value: fuelPrices.petrol },
            { onConflict: "series_id,date" }
          );

          if (!error) {
            totalPointsUpdated++;
            console.log(`Updated petrol price: ${fuelPrices.petrol}`);
          } else {
            errors.push(`Fuel price error: ${error.message}`);
          }

          await supabase
            .from("indicators")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", indicatorId);
        }
      }
    }

    // 4. Refresh GSE stocks (placeholder for future real data source)
    console.log("GSE stock data requires manual update or real-time feed integration.");

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

    console.log(`Daily refresh completed in ${duration}ms. Updated ${totalPointsUpdated} data points.`);

    return new Response(
      JSON.stringify({
        success: true,
        totalPointsUpdated,
        durationMs: duration,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Daily refresh error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
