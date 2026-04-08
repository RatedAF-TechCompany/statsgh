import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrencyRate {
  id: string;
  base_currency: string | null;
  target_currency: string | null;
  rate: number;
  change_percent: number | null;
}

interface CommodityPrice {
  id: string;
  commodity: string;
  price: number;
  change_percent: number | null;
  currency: string | null;
}

interface IndicatorItem {
  label: string;
  value: string;
  change: number | null;
  isGold?: boolean;
}

const EconomicIndicatorStrip = () => {
  const { data: currencies } = useQuery({
    queryKey: ["strip-currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("id, base_currency, target_currency, rate, change_percent")
        .eq("target_currency", "GHS")
        .order("fetched_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      // Dedupe by base_currency, keep latest
      const seen = new Set<string>();
      return (data || []).filter((r) => {
        const key = r.base_currency || "";
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    refetchInterval: 60000,
  });

  const { data: commodities } = useQuery({
    queryKey: ["strip-commodities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commodity_prices")
        .select("id, commodity, price, change_percent, currency")
        .order("fetched_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((c) => {
        if (seen.has(c.commodity)) return false;
        seen.add(c.commodity);
        return true;
      });
    },
    refetchInterval: 60000,
  });

  const items: IndicatorItem[] = [];

  // Currency pairs
  const wantedCurrencies = ["USD", "EUR", "GBP"];
  wantedCurrencies.forEach((base) => {
    const rate = currencies?.find((r) => r.base_currency === base);
    if (rate) {
      items.push({
        label: `${base}/GHS`,
        value: rate.rate.toFixed(2),
        change: rate.change_percent,
      });
    }
  });

  // Commodities
  const wantedCommodities = [
    { key: "Gold", label: "Gold" },
    { key: "Cocoa", label: "Cocoa" },
    { key: "Crude Oil", label: "Crude Oil" },
  ];
  wantedCommodities.forEach(({ key, label }) => {
    const c = commodities?.find(
      (cm) => cm.commodity.toLowerCase().includes(key.toLowerCase())
    );
    if (c) {
      items.push({
        label,
        value: `$${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        change: c.change_percent,
      });
    }
  });

  const isLoading = !currencies && !commodities;

  if (isLoading) {
    return (
      <div className="bg-[#33302E] overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-2 flex gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-24 skeleton-ft opacity-20" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  // Duplicate for seamless scroll
  const tickerItems = [...items, ...items];

  return (
    <div className="bg-[#33302E] overflow-hidden">
      <div className="flex items-center">
        <div className="flex-shrink-0 px-4 py-2">
          <span className="font-ui text-[10px] font-bold tracking-[0.15em] uppercase text-[#C9A84C]">
            Markets
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="animate-ticker flex gap-8 py-2 hover:pause">
            {tickerItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-ui text-[11px] font-semibold text-[#C9A84C]">
                  {item.label}
                </span>
                <span className="font-ui text-[12px] text-white font-medium">
                  {item.value}
                </span>
                {item.change !== null && item.change !== undefined && (
                  <span
                    className={`flex items-center gap-0.5 font-ui text-[11px] ${
                      item.change > 0
                        ? "text-[#00A36C]"
                        : item.change < 0
                        ? "text-[#CC0000]"
                        : "text-white/50"
                    }`}
                  >
                    {item.change > 0 ? (
                      <TrendingUp size={10} />
                    ) : item.change < 0 ? (
                      <TrendingDown size={10} />
                    ) : (
                      <Minus size={10} />
                    )}
                    {item.change > 0 ? "+" : ""}
                    {item.change.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EconomicIndicatorStrip;
