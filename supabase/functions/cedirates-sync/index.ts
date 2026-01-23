import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExchangeRate {
  currency: string;
  buy: number;
  sell: number;
  mid: number;
  source: string;
}

interface FuelPrice {
  omc: string;
  product: string;
  price: number;
}

interface GhanaApiExchangeResponse {
  data: {
    USD?: { buying: number; selling: number };
    EUR?: { buying: number; selling: number };
    GBP?: { buying: number; selling: number };
  };
  source?: string;
}

interface GhanaApiFuelResponse {
  data: Array<{
    company: string;
    petrol: number;
    diesel: number;
  }>;
}

// Fetch exchange rates from Ghana API (more reliable than scraping)
async function fetchGhanaApiExchangeRates(): Promise<ExchangeRate[]> {
  try {
    const response = await fetch("https://api.ghana-api.dev/api/v1/exchange-rates/current?currencies=USD,EUR,GBP", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "StatsGH/1.0",
      },
    });

    if (!response.ok) {
      console.log("Ghana API exchange rates unavailable:", response.status);
      return [];
    }

    const data: GhanaApiExchangeResponse = await response.json();
    const rates: ExchangeRate[] = [];

    if (data.data?.USD) {
      const mid = (data.data.USD.buying + data.data.USD.selling) / 2;
      rates.push({
        currency: "USD",
        buy: data.data.USD.buying,
        sell: data.data.USD.selling,
        mid,
        source: data.source || "Ghana API",
      });
    }

    if (data.data?.EUR) {
      const mid = (data.data.EUR.buying + data.data.EUR.selling) / 2;
      rates.push({
        currency: "EUR",
        buy: data.data.EUR.buying,
        sell: data.data.EUR.selling,
        mid,
        source: data.source || "Ghana API",
      });
    }

    if (data.data?.GBP) {
      const mid = (data.data.GBP.buying + data.data.GBP.selling) / 2;
      rates.push({
        currency: "GBP",
        buy: data.data.GBP.buying,
        sell: data.data.GBP.selling,
        mid,
        source: data.source || "Ghana API",
      });
    }

    console.log(`Ghana API returned ${rates.length} exchange rates`);
    return rates;
  } catch (error) {
    console.error("Error fetching Ghana API exchange rates:", error);
    return [];
  }
}

// Fallback: Fetch from Bank of Ghana interbank rates page
async function fetchBOGInterbank(): Promise<ExchangeRate[]> {
  try {
    const response = await fetch("https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/", {
      headers: {
        "User-Agent": "StatsGH/1.0",
        "Accept": "text/html",
      },
    });

    if (!response.ok) {
      console.log("BoG interbank page unavailable:", response.status);
      return [];
    }

    const html = await response.text();
    const rates: ExchangeRate[] = [];

    // Look for USD rate in table - pattern: USD ... buying ... selling
    // BoG format is typically in a table with columns
    const usdMatch = html.match(/USD[^<]*?<[^>]*>[^<]*<[^>]*>([0-9.]+)[^<]*<[^>]*>[^<]*<[^>]*>([0-9.]+)/i);
    if (usdMatch) {
      const buy = parseFloat(usdMatch[1]);
      const sell = parseFloat(usdMatch[2]);
      if (!isNaN(buy) && !isNaN(sell) && buy > 10 && sell > 10) {
        rates.push({
          currency: "USD",
          buy,
          sell,
          mid: (buy + sell) / 2,
          source: "Bank of Ghana",
        });
      }
    }

    console.log(`BoG fallback returned ${rates.length} exchange rates`);
    return rates;
  } catch (error) {
    console.error("Error fetching BoG rates:", error);
    return [];
  }
}

// Fetch fuel prices from Ghana API
async function fetchFuelPrices(): Promise<FuelPrice[]> {
  try {
    const response = await fetch("https://api.ghana-api.dev/api/v1/transport/fuel-prices", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "StatsGH/1.0",
      },
    });

    if (!response.ok) {
      console.log("Ghana API fuel prices unavailable:", response.status);
      return [];
    }

    const data: GhanaApiFuelResponse = await response.json();
    const prices: FuelPrice[] = [];

    // Calculate average prices across OMCs
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

      if (petrolCount > 0) {
        prices.push({
          omc: "Average",
          product: "Petrol",
          price: totalPetrol / petrolCount,
        });
      }

      if (dieselCount > 0) {
        prices.push({
          omc: "Average",
          product: "Diesel",
          price: totalDiesel / dieselCount,
        });
      }
    }

    console.log(`Ghana API returned ${prices.length} fuel prices`);
    return prices;
  } catch (error) {
    console.error("Error fetching fuel prices:", error);
    return [];
  }
}

// Fetch BoG policy rate
async function fetchPolicyRate(): Promise<number | null> {
  try {
    const response = await fetch("https://www.bog.gov.gh/monetary-policy/policy-rate-trends/", {
      headers: {
        "User-Agent": "StatsGH/1.0",
        "Accept": "text/html",
      },
    });

    if (!response.ok) {
      console.log("BoG policy rate page unavailable:", response.status);
      return null;
    }

    const html = await response.text();

    // Look for the latest policy rate value - typically shown prominently
    // Pattern: rate followed by % or percentage context
    const rateMatch = html.match(/(?:current|latest|policy)\s*(?:rate|mpr)[^0-9]*?([0-9]{1,2}(?:\.[0-9]+)?)\s*%/i);
    if (rateMatch) {
      const rate = parseFloat(rateMatch[1]);
      if (!isNaN(rate) && rate >= 10 && rate <= 50) {
        console.log(`Found BoG policy rate: ${rate}%`);
        return rate;
      }
    }

    // Alternative pattern: look for a number followed by % near "policy rate"
    const altMatch = html.match(/([0-9]{1,2}(?:\.[0-9]+)?)\s*%[^<]*policy\s*rate/i);
    if (altMatch) {
      const rate = parseFloat(altMatch[1]);
      if (!isNaN(rate) && rate >= 10 && rate <= 50) {
        console.log(`Found BoG policy rate (alt): ${rate}%`);
        return rate;
      }
    }

    console.log("Could not parse policy rate from BoG page");
    return null;
  } catch (error) {
    console.error("Error fetching policy rate:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting Ghana data sync...");

    // Fetch data from multiple sources
    let exchangeRates = await fetchGhanaApiExchangeRates();
    
    // Fallback to BoG if Ghana API fails
    if (exchangeRates.length === 0) {
      console.log("Trying BoG fallback for exchange rates...");
      exchangeRates = await fetchBOGInterbank();
    }

    const fuelPrices = await fetchFuelPrices();
    const policyRate = await fetchPolicyRate();

    // Get Ghana national geography ID
    const { data: ghana } = await supabase
      .from("geographies")
      .select("id")
      .eq("name", "Ghana")
      .eq("type", "country")
      .single();

    if (!ghana) {
      throw new Error("Ghana geography not found");
    }

    // Get CediRates source ID (we use this as the aggregator source)
    const { data: cediRatesSource } = await supabase
      .from("data_sources")
      .select("id")
      .eq("short_name", "CediRates")
      .single();

    const sourceId = cediRatesSource?.id;

    // Get indicator IDs
    const { data: indicators } = await supabase
      .from("indicators")
      .select("id, slug")
      .in("slug", ["exchange-rate-ghs-usd", "policy-rate"]);

    const indicatorMap = new Map(indicators?.map((i) => [i.slug, i.id]) || []);

    const results = {
      exchangeRatesUpdated: 0,
      policyRateUpdated: false,
      fuelPricesFound: fuelPrices.length,
      errors: [] as string[],
    };

    const today = new Date().toISOString().split("T")[0];

    // Update USD exchange rate
    const usdRate = exchangeRates.find((r) => r.currency === "USD");
    if (usdRate && usdRate.mid > 10) { // Sanity check: USD/GHS should be > 10
      const indicatorId = indicatorMap.get("exchange-rate-ghs-usd");
      if (indicatorId) {
        // Get or create primary series
        let { data: series } = await supabase
          .from("data_series")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("geography_id", ghana.id)
          .eq("is_primary", true)
          .single();

        if (!series) {
          const { data: newSeries } = await supabase
            .from("data_series")
            .insert({
              indicator_id: indicatorId,
              geography_id: ghana.id,
              source_id: sourceId,
              is_primary: true,
            })
            .select("id")
            .single();
          series = newSeries;
        }

        if (series) {
          const { error } = await supabase.from("data_points").upsert(
            {
              series_id: series.id,
              date: today,
              value: usdRate.mid,
            },
            { onConflict: "series_id,date" }
          );

          if (error) {
            results.errors.push(`Exchange rate upsert error: ${error.message}`);
          } else {
            results.exchangeRatesUpdated++;
            console.log(`Updated USD/GHS rate: ${usdRate.mid} (buy: ${usdRate.buy}, sell: ${usdRate.sell})`);

            // Update indicator timestamp
            await supabase
              .from("indicators")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", indicatorId);
          }
        }
      }
    } else if (usdRate) {
      results.errors.push(`USD rate ${usdRate.mid} failed sanity check (should be > 10)`);
    }

    // Update policy rate
    if (policyRate !== null && policyRate >= 10 && policyRate <= 50) {
      const indicatorId = indicatorMap.get("policy-rate");
      if (indicatorId) {
        // Get or create primary series
        let { data: series } = await supabase
          .from("data_series")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("geography_id", ghana.id)
          .eq("is_primary", true)
          .single();

        if (!series) {
          const { data: newSeries } = await supabase
            .from("data_series")
            .insert({
              indicator_id: indicatorId,
              geography_id: ghana.id,
              source_id: sourceId,
              is_primary: true,
            })
            .select("id")
            .single();
          series = newSeries;
        }

        if (series) {
          const { error } = await supabase.from("data_points").upsert(
            {
              series_id: series.id,
              date: today,
              value: policyRate,
            },
            { onConflict: "series_id,date" }
          );

          if (error) {
            results.errors.push(`Policy rate upsert error: ${error.message}`);
          } else {
            results.policyRateUpdated = true;
            console.log(`Updated Policy Rate: ${policyRate}%`);

            await supabase
              .from("indicators")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", indicatorId);
          }
        }
      }
    }

    // Log the run
    await supabase.from("ingestion_runs").insert({
      indicator_slug: "ghana-data-sync",
      run_type: "automated",
      status: results.errors.length > 0 ? "partial" : "success",
      rows_inserted: results.exchangeRatesUpdated + (results.policyRateUpdated ? 1 : 0),
      error_message: results.errors.length > 0 ? results.errors.join("; ") : null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          exchangeRates,
          fuelPrices,
          policyRate,
        },
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Ghana data sync error:", error);
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
