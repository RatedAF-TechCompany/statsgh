import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface IndicatorWithData {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  unit: string;
  unit_display: string | null;
  decimal_places: number | null;
  latestValue: number | null;
  previousValue: number | null;
  latestDate: string | null;
  change: number | null;
  changePercent: number | null;
  sparklineData: number[];
}

const Sparkline = ({ data, positive }: { data: number[]; positive: boolean | null }) => {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const width = 60;
  const height = 24;
  const padding = 2;
  
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  
  const strokeColor = positive === null 
    ? 'hsl(var(--muted-foreground))' 
    : positive 
      ? 'hsl(142, 76%, 36%)' 
      : 'hsl(0, 84%, 60%)';
  
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const formatValue = (value: number | null, unit: string, decimals: number | null) => {
  if (value === null) return "—";
  const decimalPlaces = decimals ?? 2;
  
  if (unit === "percent" || unit === "%") {
    return `${value.toFixed(decimalPlaces)}%`;
  }
  if (unit === "currency_ghs" || unit === "GHS") {
    return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}`;
  }
  if (unit === "currency_usd" || unit === "USD") {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}`;
  }
  if (unit === "billion_ghs") {
    return `GHS ${value.toFixed(decimalPlaces)}B`;
  }
  if (unit === "billion_usd") {
    return `$${value.toFixed(decimalPlaces)}B`;
  }
  if (unit === "ratio") {
    return value.toFixed(decimalPlaces);
  }
  
  return value.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
};

const GhanaDataHighlights = () => {
  const navigate = useNavigate();

  const { data: indicators, isLoading } = useQuery({
    queryKey: ["ghana-core-indicators-highlights"],
    queryFn: async () => {
      // Get Ghana geography
      const { data: ghana } = await supabase
        .from("geographies")
        .select("id")
        .eq("is_ghana", true)
        .single();

      if (!ghana) return [];

      // Get core indicators
      const { data: coreIndicators, error: indicatorsError } = await supabase
        .from("indicators")
        .select("id, name, short_name, slug, unit, unit_display, decimal_places")
        .eq("is_ghana_core", true)
        .order("name")
        .limit(8);

      if (indicatorsError || !coreIndicators) return [];

      // For each indicator, get the Ghana series and its recent data points
      const indicatorsWithData: IndicatorWithData[] = await Promise.all(
        coreIndicators.map(async (indicator) => {
          // Get primary Ghana series
          const { data: series } = await supabase
            .from("data_series")
            .select("id")
            .eq("indicator_id", indicator.id)
            .eq("geography_id", ghana.id)
            .eq("is_primary", true)
            .single();

          if (!series) {
            return {
              ...indicator,
              latestValue: null,
              previousValue: null,
              latestDate: null,
              change: null,
              changePercent: null,
              sparklineData: [],
            };
          }

          // Get last 12 data points for sparkline
          const { data: dataPoints } = await supabase
            .from("data_points")
            .select("value, date")
            .eq("series_id", series.id)
            .order("date", { ascending: false })
            .limit(12);

          if (!dataPoints || dataPoints.length === 0) {
            return {
              ...indicator,
              latestValue: null,
              previousValue: null,
              latestDate: null,
              change: null,
              changePercent: null,
              sparklineData: [],
            };
          }

          const latestValue = Number(dataPoints[0].value);
          const previousValue = dataPoints.length > 1 ? Number(dataPoints[1].value) : null;
          const change = previousValue !== null ? latestValue - previousValue : null;
          const changePercent = previousValue !== null && previousValue !== 0 
            ? ((latestValue - previousValue) / Math.abs(previousValue)) * 100 
            : null;

          // Reverse for sparkline (oldest to newest)
          const sparklineData = dataPoints
            .map(dp => Number(dp.value))
            .reverse();

          return {
            ...indicator,
            latestValue,
            previousValue,
            latestDate: dataPoints[0].date,
            change,
            changePercent,
            sparklineData,
          };
        })
      );

      // Filter out indicators without data
      return indicatorsWithData.filter(i => i.latestValue !== null);
    },
  });

  if (isLoading) {
    return (
      <section className="border-b border-border bg-muted/30">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">Ghana Data</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 bg-background rounded-lg border border-border">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-16 mb-1" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!indicators || indicators.length === 0) {
    return null;
  }

  // Determine if change is positive (for styling)
  const isPositiveChange = (indicator: IndicatorWithData): boolean | null => {
    if (indicator.change === null) return null;
    // For inflation/prices, lower might be better, but we'll show direction
    return indicator.change >= 0;
  };

  return (
    <section className="border-b border-border bg-muted/30">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">Ghana Data</h2>
          <button
            onClick={() => navigate('/data')}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            All indicators
            <ArrowRight size={14} />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {indicators.slice(0, 6).map((indicator) => {
            const positive = isPositiveChange(indicator);
            
            return (
              <button
                key={indicator.id}
                onClick={() => navigate(`/data/${indicator.slug}`)}
                className="p-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {indicator.short_name || indicator.name}
                  </span>
                  <Sparkline data={indicator.sparklineData} positive={positive} />
                </div>
                
                <div className="text-lg font-semibold text-foreground">
                  {formatValue(indicator.latestValue, indicator.unit, indicator.decimal_places)}
                </div>
                
                <div className="flex items-center gap-1 mt-0.5">
                  {positive !== null && (
                    <>
                      {positive ? (
                        <TrendingUp size={12} className="text-green-600" />
                      ) : indicator.change === 0 ? (
                        <Minus size={12} className="text-muted-foreground" />
                      ) : (
                        <TrendingDown size={12} className="text-red-500" />
                      )}
                      <span className={`text-xs ${positive ? 'text-green-600' : indicator.change === 0 ? 'text-muted-foreground' : 'text-red-500'}`}>
                        {indicator.changePercent !== null 
                          ? `${indicator.changePercent >= 0 ? '+' : ''}${indicator.changePercent.toFixed(1)}%`
                          : '—'
                        }
                      </span>
                    </>
                  )}
                  {indicator.latestDate && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(indicator.latestDate), "MMM yy")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GhanaDataHighlights;
