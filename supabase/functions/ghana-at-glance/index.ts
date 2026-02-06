import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecondaryData {
  value: string;
  period: string;
  source: string;
}

interface GlanceCard {
  id: string;
  value: string;
  unit: string;
  label: string;
  sublabel: string;
  period: string;
  source: string;
  status: 'ok' | 'unavailable';
  secondary?: SecondaryData;
}

interface GlanceResponse {
  cards: GlanceCard[];
  fetchedAt: string;
}

// Card configuration — maps card IDs to database slugs and display rules
interface CardConfig {
  id: string;
  slug: string;
  label: string;
  unit: string;
  source: string;
  formatValue: (value: number) => string;
  formatPeriod: (date: Date) => string;
  formatSublabel: (period: string, source: string) => string;
}

function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(num: number, decimals = 1): string {
  return `${num.toFixed(decimals)}%`;
}

function formatMonthYear(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${date.getFullYear()}`;
}

function formatQuarterYear(date: Date): string {
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${date.getFullYear()}`;
}

function formatDayMonthYear(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

// All 10 card definitions
const CARD_CONFIGS: CardConfig[] = [
  {
    id: 'inflation',
    slug: 'cpi-inflation',
    label: 'Headline inflation',
    unit: '%',
    source: 'GSS',
    formatValue: (v) => formatPercent(v),
    formatPeriod: formatMonthYear,
    formatSublabel: (p, s) => `${p} YoY • ${s}`,
  },
  {
    id: 'food-inflation',
    slug: 'food-inflation',
    label: 'Food inflation',
    unit: '%',
    source: 'GSS',
    formatValue: (v) => formatPercent(v),
    formatPeriod: formatMonthYear,
    formatSublabel: (p, s) => `${p} YoY • ${s}`,
  },
  {
    id: 'gdp-growth',
    slug: 'gdp-growth-rate',
    label: 'GDP growth',
    unit: '%',
    source: 'GSS',
    formatValue: (v) => formatPercent(v),
    formatPeriod: formatQuarterYear,
    formatSublabel: (p, s) => `${p} QoQ SA • ${s}`,
  },
  {
    id: 'policy-rate',
    slug: 'policy-rate',
    label: 'BoG policy rate',
    unit: '%',
    source: 'BoG',
    formatValue: (v) => formatPercent(v),
    formatPeriod: formatMonthYear,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
  {
    id: 'exchange-rate',
    slug: 'exchange-rate-ghs-usd',
    label: 'USD/GHS rate',
    unit: 'GHS',
    source: 'BoG',
    formatValue: (v) => `GHS ${formatNumber(v, 2)}`,
    formatPeriod: formatDayMonthYear,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
  {
    id: 'fuel-price',
    slug: 'fuel-price-petrol',
    label: 'Petrol price',
    unit: 'GHS/L',
    source: 'NPA',
    formatValue: (v) => `GHS ${formatNumber(v, 2)}/L`,
    formatPeriod: formatDayMonthYear,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
  {
    id: 'private-credit',
    slug: 'credit-private-sector',
    label: 'Private sector credit',
    unit: 'GHS',
    source: 'BoG',
    formatValue: (v) => `GHS ${formatNumber(v, 1)}B`,
    formatPeriod: formatMonthYear,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
  {
    id: 'population',
    slug: 'population-total',
    label: 'Population',
    unit: '',
    source: 'WB',
    formatValue: (v) => `${formatNumber(v, 1)}M`,
    formatPeriod: (d) => `${d.getFullYear()}`,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
  {
    id: 'unemployment',
    slug: 'unemployment-rate',
    label: 'Unemployment rate',
    unit: '%',
    source: 'WB',
    formatValue: (v) => formatPercent(v),
    formatPeriod: (d) => `${d.getFullYear()}`,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
  {
    id: 'fertility-rate',
    slug: 'fertility-rate',
    label: 'Fertility rate',
    unit: 'births',
    source: 'WB',
    formatValue: (v) => formatNumber(v, 1),
    formatPeriod: (d) => `${d.getFullYear()}`,
    formatSublabel: (p, s) => `${p} • ${s}`,
  },
];

// Fetch all card data from the database in a single efficient query
async function fetchAllCardsFromDB(): Promise<GlanceCard[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const slugs = CARD_CONFIGS.map(c => c.slug);

  // Fetch latest 2 data points per indicator for change detection
  const { data: dbData, error } = await supabase
    .from('data_points')
    .select(`
      value,
      date,
      data_series!inner(
        indicator_id,
        is_primary,
        geography:geographies!inner(is_ghana),
        indicator:indicators!inner(slug, name, short_name)
      ),
      source:data_sources(short_name, name)
    `)
    .eq('data_series.is_primary', true)
    .eq('data_series.geography.is_ghana', true)
    .in('data_series.indicator.slug', slugs)
    .order('date', { ascending: false });

  if (error) {
    console.error('DB fetch error:', error);
    return [];
  }

  // Group by slug and take the latest value
  const latestBySlug = new Map<string, { value: number; date: string; sourceName: string }>();

  for (const point of dbData || []) {
    const series = point.data_series as any;
    const slug = series?.indicator?.slug;
    if (!slug) continue;

    if (!latestBySlug.has(slug)) {
      const sourceName = (point.source as any)?.short_name || (point.source as any)?.name || '';
      latestBySlug.set(slug, {
        value: Number(point.value),
        date: point.date,
        sourceName,
      });
    }
  }

  console.log('DB data loaded for slugs:', [...latestBySlug.keys()]);

  // Build cards
  const cards: GlanceCard[] = [];

  for (const config of CARD_CONFIGS) {
    const dbEntry = latestBySlug.get(config.slug);

    if (!dbEntry) {
      console.warn(`No DB data for ${config.slug}`);
      cards.push({
        id: config.id,
        value: '—',
        unit: config.unit,
        label: config.label,
        sublabel: 'Data unavailable',
        period: '',
        source: config.source,
        status: 'unavailable',
      });
      continue;
    }

    const date = new Date(dbEntry.date);
    const period = config.formatPeriod(date);
    const source = dbEntry.sourceName || config.source;

    cards.push({
      id: config.id,
      value: config.formatValue(dbEntry.value),
      unit: config.unit,
      label: config.label,
      sublabel: config.formatSublabel(period, source),
      period,
      source,
      status: 'ok',
    });
  }

  return cards;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching Ghana At A Glance data (DB-first)...');

    const cards = await fetchAllCardsFromDB();

    const response: GlanceResponse = {
      cards,
      fetchedAt: new Date().toISOString(),
    };

    console.log(`Ghana At A Glance: ${cards.filter(c => c.status === 'ok').length}/${cards.length} cards OK`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Ghana At A Glance error:', error);

    return new Response(JSON.stringify({
      error: 'Failed to fetch data',
      cards: [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
