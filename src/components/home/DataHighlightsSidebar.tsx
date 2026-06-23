import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { SidebarSection } from "./SidebarSection";

interface IndicatorWithData {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  unit: string;
  decimal_places: number | null;
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  latestDate: string | null;
}

const formatValue = (value: number | null, unit: string, decimals: number | null) => {
  if (value === null) return "—";
  const decimalPlaces = decimals ?? 1;
  
  if (unit === "percent" || unit === "%") {
    return `${value.toFixed(decimalPlaces)}%`;
  }
  if (unit === "currency_ghs" || unit === "GHS") {
    return `GHS ${value.toLocaleString(undefined, { maximumFractionDigits: decimalPlaces })}`;
  }
  if (unit === "currency_usd" || unit === "USD") {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: decimalPlaces })}`;
  }
  if (unit === "billion_ghs") {
    return `GHS ${value.toFixed(decimalPlaces)}B`;
  }
  if (unit === "billion_usd") {
    return `$${value.toFixed(decimalPlaces)}B`;
  }
  
  return value.toLocaleString(undefined, { maximumFractionDigits: decimalPlaces });
};

const DataHighlightsSidebar = () => {
  const { data: indicators, isLoading } = useQuery({
    queryKey: ["data-highlights-sidebar"],
    queryFn: async () => {
      const { data: ghanaRows } = await supabase
        .from("geographies")
        .select("id")
        .eq("is_ghana", true)
        .eq("type", "country")
        .limit(1);

      const ghana = ghanaRows?.[0] ?? null;

      if (!ghana) return [];

      const { data: coreIndicators } = await supabase
        .from("indicators")
        .select("id, name, short_name, slug, unit, decimal_places")
        .eq("is_ghana_core", true)
        .order("name")
        .limit(4);

      if (!coreIndicators) return [];

      const indicatorsWithData: IndicatorWithData[] = await Promise.all(
        coreIndicators.map(async (indicator) => {
          const { data: series } = await supabase
            .from("data_series")
            .select("id")
            .eq("indicator_id", indicator.id)
            .eq("geography_id", ghana.id)
            .eq("is_primary", true)
            .single();

          if (!series) {
            return { ...indicator, latestValue: null, change: null, changePercent: null, latestDate: null };
          }

          const { data: dataPoints } = await supabase
            .from("data_points")
            .select("value, date")
            .eq("series_id", series.id)
            .order("date", { ascending: false })
            .limit(2);

          if (!dataPoints || dataPoints.length === 0) {
            return { ...indicator, latestValue: null, change: null, changePercent: null, latestDate: null };
          }

          const latestValue = Number(dataPoints[0].value);
          const previousValue = dataPoints.length > 1 ? Number(dataPoints[1].value) : null;
          const change = previousValue !== null ? latestValue - previousValue : null;
          const changePercent = previousValue !== null && previousValue !== 0 
            ? ((latestValue - previousValue) / Math.abs(previousValue)) * 100 
            : null;

          return { ...indicator, latestValue, change, changePercent, latestDate: dataPoints[0].date };
        })
      );

      return indicatorsWithData.filter(i => i.latestValue !== null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!indicators || indicators.length === 0) return null;

  return (
    <SidebarSection title="Ghana Data" viewAllHref="/data" viewAllLabel="All data">
      <div className="space-y-0">
        {indicators.map((indicator) => {
          const positive = indicator.change !== null ? indicator.change >= 0 : null;

          return (
            <Link
              key={indicator.id}
              to={`/data/${indicator.slug}`}
              className="w-full flex items-center justify-between py-2.5 border-b border-border hover:bg-muted/30 transition-colors text-left group"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs text-muted-foreground block truncate">
                  {indicator.short_name || indicator.name}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatValue(indicator.latestValue, indicator.unit, indicator.decimal_places)}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {positive !== null && (
                  <>
                    {positive ? (
                      <TrendingUp size={12} className="text-accent-green" />
                    ) : indicator.change === 0 ? (
                      <Minus size={12} className="text-muted-foreground" />
                    ) : (
                      <TrendingDown size={12} className="text-destructive" />
                    )}
                    <span className={`text-xs ${positive ? 'text-accent-green' : indicator.change === 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {indicator.changePercent !== null 
                        ? `${indicator.changePercent >= 0 ? '+' : ''}${indicator.changePercent.toFixed(1)}%`
                        : '—'
                      }
                    </span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </SidebarSection>
  );
};

export default DataHighlightsSidebar;
