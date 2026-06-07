import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const COMMODITY_DISPLAY_NAMES: Record<string, string> = {
  oil_brent: "Brent Crude", brent: "Brent Crude", oil_wti: "WTI Crude", wti: "WTI Crude",
  cocoa: "Cocoa", gold: "Gold", natural_gas: "Nat Gas", nat_gas: "Nat Gas", crude_oil: "Crude Oil",
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
      const { data, error } = await supabase.from("currency_rates")
        .select("id, base_currency, target_currency, rate, change_percent")
        .eq("target_currency", "GHS").order("fetched_at", { ascending: false }).limit(10);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((r) => { const k = r.base_currency || ""; if (seen.has(k)) return false; seen.add(k); return true; });
    },
    refetchInterval: 60000,
  });

  const { data: commodities, isLoading: comLoading } = useQuery({
    queryKey: ["rail-commodities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commodity_prices")
        .select("id, commodity, price, change_percent, currency")
        .order("fetched_at", { ascending: false }).limit(20);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((c) => { if (seen.has(c.commodity)) return false; seen.add(c.commodity); return true; });
    },
    refetchInterval: 60000,
  });

  const { data: gseIndex } = useQuery({
    queryKey: ["rail-gse"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gse_stocks")
        .select("symbol, current_price, change_percent")
        .order("market_cap", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const isLoading = currLoading || comLoading;

  const ChangeIndicator = ({ change }: { change: number | null }) => {
    if (change === null || change === undefined) return null;
    return (
      <span className={`flex items-center gap-0.5 font-ui text-[11px] ${change > 0 ? "text-[#00A36C]" : change < 0 ? "text-[#CC0000]" : "text-[#66605A]"}`}>
        {change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {change > 0 ? "+" : ""}{change.toFixed(1)}%
      </span>
    );
  };

  return (
    <aside className="sticky top-[130px]">
      {/* Ghana At A Glance */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-[#e8e8e8]" />
          <span className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#33302E]">Ghana At A Glance</span>
          <div className="flex-1 h-px bg-[#e8e8e8]" />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
        ) : (
          <>
            {/* Exchange Rates */}
            <h3 className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#66605A] mb-2">Exchange Rates</h3>
            <div className="space-y-0 mb-4">
              {(currencies || []).slice(0, 4).map((rate) => (
                <div key={rate.id} className="flex items-center justify-between py-1.5 border-t border-[#e8e8e8]">
                  <span className="font-ui text-[11px] font-medium text-[#33302E]">{rate.base_currency}/GHS</span>
                  <div className="flex items-center gap-2">
                    <span className="font-ui text-[12px] font-semibold text-[#33302E]">{rate.rate.toFixed(2)}</span>
                    <ChangeIndicator change={rate.change_percent} />
                  </div>
                </div>
              ))}
            </div>

            {/* Commodities */}
            <h3 className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#66605A] mb-2">Commodities</h3>
            <div className="space-y-0 mb-4">
              {(commodities || []).slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 border-t border-[#e8e8e8]">
                  <span className="font-ui text-[11px] font-medium text-[#33302E]">{cleanCommodityName(c.commodity)}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-ui text-[12px] font-semibold text-[#33302E]">${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <ChangeIndicator change={c.change_percent} />
                  </div>
                </div>
              ))}
            </div>

            {/* GSE */}
            {gseIndex && gseIndex.length > 0 && (
              <>
                <h3 className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#66605A] mb-2">GSE Stocks</h3>
                <div className="space-y-0 mb-3">
                  {gseIndex.map((s) => (
                    <div key={s.symbol} className="flex items-center justify-between py-1.5 border-t border-[#e8e8e8]">
                      <span className="font-ui text-[11px] font-medium text-[#33302E]">{s.symbol}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-ui text-[12px] font-semibold text-[#33302E]">₵{s.current_price.toFixed(2)}</span>
                        <ChangeIndicator change={s.change_percent} />
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate("/dashboards/gse")} className="font-ui text-[11px] text-[#0D7680] hover:underline">
                  Full GSE dashboard →
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Quick Links */}
      <div className="border-t border-[#e8e8e8] pt-4">
        <h3 className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-[#66605A] mb-2">Explore</h3>
        <div className="space-y-1.5">
          {[
            { label: "All Data Indicators", href: "/data" },
            { label: "Economic Calendar", href: "/calendar" },
            { label: "Finance Dashboard", href: "/dashboards/finance" },
          ].map((link) => (
            <button key={link.href} onClick={() => navigate(link.href)} className="block font-ui text-[11px] text-[#0D7680] hover:underline">
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default DataRail;
