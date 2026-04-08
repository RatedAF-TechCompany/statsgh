import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
// Clean display name mapping for commodity keys
const COMMODITY_DISPLAY_NAMES: Record<string, string> = {
  oil_brent: "Brent Crude",
  brent: "Brent Crude",
  oil_wti: "WTI Crude",
  wti: "WTI Crude",
  cocoa: "Cocoa",
  gold: "Gold",
  natural_gas: "Nat Gas",
  nat_gas: "Nat Gas",
  crude_oil: "Crude Oil",
};

function cleanCommodityName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (COMMODITY_DISPLAY_NAMES[lower]) return COMMODITY_DISPLAY_NAMES[lower];
  for (const [key, display] of Object.entries(COMMODITY_DISPLAY_NAMES)) {
    if (lower.includes(key) || key.includes(lower)) return display;
  }
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DataRail = () => {
  const navigate = useNavigate();

  const { data: currencies, isLoading: currLoading } = useQuery({
    queryKey: ["rail-currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("id, base_currency, target_currency, rate, change_percent")
        .eq("target_currency", "GHS")
        .order("fetched_at", { ascending: false })
        .limit(10);
      if (error) throw error;
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

  const { data: commodities, isLoading: comLoading } = useQuery({
    queryKey: ["rail-commodities"],
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

  const { data: gseIndex } = useQuery({
    queryKey: ["rail-gse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gse_stocks")
        .select("symbol, current_price, change_percent")
        .order("market_cap", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const isLoading = currLoading || comLoading;

  return (
    <aside className="sticky top-[88px]">
      <h2 className="font-ui text-[11px] font-bold tracking-[0.15em] uppercase text-[#C9A84C] mb-4 border-b border-[#C9A84C] pb-2">
        Ghana At A Glance
      </h2>

      {/* Exchange Rates */}
      <div className="mb-6">
        <h3 className="font-ui text-xs font-semibold text-[#33302E] mb-3">Exchange Rates</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full skeleton-ft" />)}
          </div>
        ) : (
          <div className="space-y-0">
            {(currencies || []).slice(0, 4).map((rate) => (
              <div key={rate.id} className="flex items-center justify-between py-2 border-b border-[#E8D9C5]">
                <span className="font-ui text-xs font-medium text-[#33302E]">
                  {rate.base_currency}/GHS
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-ui text-sm font-semibold text-[#33302E]">
                    {rate.rate.toFixed(2)}
                  </span>
                  {rate.change_percent !== null && (
                    <span className={`flex items-center gap-0.5 font-ui text-[11px] ${
                      rate.change_percent > 0 ? "text-[#00A36C]" : rate.change_percent < 0 ? "text-[#CC0000]" : "text-[#66605A]"
                    }`}>
                      {rate.change_percent > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {rate.change_percent > 0 ? "+" : ""}{rate.change_percent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commodities */}
      <div className="mb-6">
        <h3 className="font-ui text-xs font-semibold text-[#33302E] mb-3">Commodities</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full skeleton-ft" />)}
          </div>
        ) : (
          <div className="space-y-0">
            {(commodities || []).slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#E8D9C5]">
                <span className="font-ui text-xs font-medium text-[#33302E]">{cleanCommodityName(c.commodity)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-ui text-sm font-semibold text-[#33302E]">
                    ${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {c.change_percent !== null && (
                    <span className={`flex items-center gap-0.5 font-ui text-[11px] ${
                      c.change_percent > 0 ? "text-[#00A36C]" : c.change_percent < 0 ? "text-[#CC0000]" : "text-[#66605A]"
                    }`}>
                      {c.change_percent > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {c.change_percent > 0 ? "+" : ""}{c.change_percent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GSE Top Movers */}
      {gseIndex && gseIndex.length > 0 && (
        <div className="mb-6">
          <h3 className="font-ui text-xs font-semibold text-[#33302E] mb-3">GSE Stocks</h3>
          <div className="space-y-0">
            {gseIndex.map((stock) => (
              <div key={stock.symbol} className="flex items-center justify-between py-2 border-b border-[#E8D9C5]">
                <span className="font-ui text-xs font-medium text-[#33302E]">{stock.symbol}</span>
                <div className="flex items-center gap-2">
                  <span className="font-ui text-sm font-semibold text-[#33302E]">
                    ₵{stock.current_price.toFixed(2)}
                  </span>
                  {stock.change_percent !== null && (
                    <span className={`flex items-center gap-0.5 font-ui text-[11px] ${
                      stock.change_percent > 0 ? "text-[#00A36C]" : stock.change_percent < 0 ? "text-[#CC0000]" : "text-[#66605A]"
                    }`}>
                      {stock.change_percent > 0 ? "+" : ""}{stock.change_percent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/dashboards/gse")}
            className="font-ui text-xs text-[#0D7680] hover:underline mt-2 block"
          >
            Full GSE dashboard →
          </button>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h3 className="font-ui text-xs font-semibold text-[#33302E] mb-3">Explore</h3>
        <div className="space-y-2">
          {[
            { label: "All Data Indicators", href: "/data" },
            { label: "Economic Calendar", href: "/calendar" },
            { label: "Finance Dashboard", href: "/dashboards/finance" },
          ].map((link) => (
            <button
              key={link.href}
              onClick={() => navigate(link.href)}
              className="block font-ui text-xs text-[#0D7680] hover:underline"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default DataRail;
