import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PxWebConfig {
  baseUrl: string;
  tablePath: string;
  dimensions: {
    time: string;
    indicator?: string;
    geography?: string;
    product?: string;
    source?: string;
  };
  fixedSelections?: Record<string, string[]>;
  geographyMapping?: Record<string, { name: string; type: string }>;
}

interface PxWebVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
  elimination?: boolean;
}

interface PxWebMetadata {
  title: string;
  variables: PxWebVariable[];
}

interface PxWebDataResponse {
  columns: { code: string; text: string; type: string }[];
  data: { key: string[]; values: string[] }[];
}

interface NormalizedDataPoint {
  geography_name: string;
  geography_type: string;
  date: string;
  value: number | null;
  unit: string;
  product_group?: string;
  source_filter?: string;
  external_key: string;
}

// Fetch table metadata to get available dimensions and values
async function fetchTableMetadata(config: PxWebConfig): Promise<PxWebMetadata> {
  const url = `${config.baseUrl}${config.tablePath}`;
  console.log(`Fetching metadata from: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// Convert PxWeb month format (2024M01) to ISO date (2024-01-01)
function parseMonth(monthStr: string): string {
  const match = monthStr.match(/^(\d{4})M(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid month format: ${monthStr}`);
  }
  return `${match[1]}-${match[2]}-01`;
}

// Query data from PxWeb API
async function queryData(
  config: PxWebConfig,
  metadata: PxWebMetadata,
  options: { latestOnly?: boolean; timeValues?: string[] } = {}
): Promise<NormalizedDataPoint[]> {
  const url = `${config.baseUrl}${config.tablePath}`;
  
  // Build query based on dimensions
  const query: { code: string; selection: { filter: string; values: string[] } }[] = [];
  
  for (const variable of metadata.variables) {
    let values: string[] = [];
    
    if (variable.code === config.dimensions.time) {
      // Time dimension
      if (options.latestOnly) {
        values = [variable.values[0]]; // First value is typically the latest
      } else if (options.timeValues) {
        values = options.timeValues;
      } else {
        values = variable.values; // All time periods
      }
    } else if (config.fixedSelections?.[variable.code]) {
      values = config.fixedSelections[variable.code];
    } else if (variable.code === config.dimensions.geography) {
      // Geography - get all or use fixed selections
      values = config.fixedSelections?.Region || ["Ghana"];
    } else if (variable.code === config.dimensions.indicator) {
      // Use fixed indicator selection or default to year-on-year
      values = config.fixedSelections?.Indicator || ["Year-on-year inflation (%)"];
    } else if (variable.code === config.dimensions.product) {
      // Product group
      values = config.fixedSelections?.Product || ["All products"];
    } else if (variable.code === config.dimensions.source) {
      // Source filter
      values = config.fixedSelections?.Source || ["All sources"];
    } else if (variable.elimination) {
      // For elimination variables not specified, use first value
      values = [variable.values[0]];
    } else {
      values = variable.values;
    }
    
    query.push({
      code: variable.code,
      selection: {
        filter: "item",
        values: values,
      },
    });
  }
  
  console.log(`Querying data with query:`, JSON.stringify(query, null, 2));
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query,
      response: {
        format: "json",
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query data: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data: PxWebDataResponse = await response.json();
  console.log(`Received ${data.data.length} data rows`);
  
  // Normalize the data
  const normalized: NormalizedDataPoint[] = [];
  
  // Build column index map
  const columnMap: Record<string, number> = {};
  data.columns.forEach((col, idx) => {
    columnMap[col.code] = idx;
  });
  
  for (const row of data.data) {
    const timeIdx = columnMap[config.dimensions.time];
    const geoIdx = config.dimensions.geography ? columnMap[config.dimensions.geography] : undefined;
    const productIdx = config.dimensions.product ? columnMap[config.dimensions.product] : undefined;
    const sourceIdx = config.dimensions.source ? columnMap[config.dimensions.source] : undefined;
    
    const timeValue = row.key[timeIdx];
    const geoValue = geoIdx !== undefined ? row.key[geoIdx] : "Ghana";
    const productValue = productIdx !== undefined ? row.key[productIdx] : undefined;
    const sourceValue = sourceIdx !== undefined ? row.key[sourceIdx] : undefined;
    
    // Parse the value
    const rawValue = row.values[0];
    let value: number | null = null;
    
    if (rawValue && rawValue !== ".." && rawValue !== "-" && rawValue !== "...") {
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }
    
    // Map geography
    const geoMapping = config.geographyMapping?.[geoValue];
    const geographyName = geoMapping?.name || geoValue;
    const geographyType = geoMapping?.type || (geoValue === "Ghana" ? "national" : "region");
    
    // Build external key for tracking
    const externalKey = JSON.stringify({
      table: config.tablePath,
      geo: geoValue,
      product: productValue,
      source: sourceValue,
    });
    
    try {
      normalized.push({
        geography_name: geographyName,
        geography_type: geographyType,
        date: parseMonth(timeValue),
        value: value,
        unit: "%",
        product_group: productValue,
        source_filter: sourceValue,
        external_key: externalKey,
      });
    } catch (e) {
      console.warn(`Skipping row with invalid date: ${timeValue}`);
    }
  }
  
  return normalized;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    const { action, config, options } = body as {
      action: "metadata" | "query" | "queryLatest";
      config: PxWebConfig;
      options?: { timeValues?: string[] };
    };
    
    if (!config?.baseUrl || !config?.tablePath) {
      throw new Error("Missing required config: baseUrl and tablePath");
    }
    
    console.log(`PxWeb Connector: Action=${action}, Table=${config.tablePath}`);
    
    // Fetch metadata first
    const metadata = await fetchTableMetadata(config);
    
    if (action === "metadata") {
      return new Response(JSON.stringify({ metadata }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Query data
    const latestOnly = action === "queryLatest";
    const data = await queryData(config, metadata, { latestOnly, ...options });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        metadata: {
          title: metadata.title,
          rowCount: data.length,
          timeRange: data.length > 0 ? {
            earliest: data[data.length - 1]?.date,
            latest: data[0]?.date,
          } : null,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("PxWeb Connector Error:", error);
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
