"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRouter } from "next/navigation";

interface Stock {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  change_percent: number | null;
}

const GSETickerStrip = () => {
  const router = useRouter();

  const { data: stocks, isLoading } = useQuery({
    queryKey: ["gse-ticker-stocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gse_stocks")
        .select("id, symbol, name, current_price, change_percent")
        .order("symbol", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data as Stock[];
    },
    refetchInterval: 60000,
  });

  if (isLoading || !stocks || stocks.length === 0) {
    return null;
  }

  const getChangeColor = (change: number | null) => {
    if (change === null || change === 0) return "text-muted-foreground";
    return change > 0 ? "text-green-400" : "text-red-600";
  };

  const getChangeIcon = (change: number | null) => {
    if (change === null || change === 0) return <Minus size={12} />;
    return change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  };

  const formatPrice = (price: number) => {
    return `GHS ${price.toFixed(2)}`;
  };

  const formatChange = (change: number | null) => {
    if (change === null) return "0.0%";
    return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
  };

  const tickerItems = [...stocks, ...stocks];

  return (
    <div className="bg-[#ad0336] text-white overflow-hidden cursor-pointer" onClick={() => router.push("/dashboards/gse")}>
      <div className="flex items-center">
        <div className="flex-shrink-0 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide">GSE</div>

        <div className="flex-1 overflow-hidden">
          <div className="animate-ticker flex gap-8 py-1.5 hover:pause">
            {tickerItems.map((stock, index) => (
              <div key={`${stock.id}-${index}`} className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span className="font-medium">{stock.symbol}</span>
                <span className="text-red-100">{formatPrice(stock.current_price)}</span>
                <span className={`flex items-center gap-0.5 ${getChangeColor(stock.change_percent)}`}>
                  {getChangeIcon(stock.change_percent)}
                  {formatChange(stock.change_percent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GSETickerStrip;
