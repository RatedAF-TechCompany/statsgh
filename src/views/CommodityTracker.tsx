"use client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  DollarSign,
  Wheat,
  Gem,
  Fuel,
  Globe,
} from "lucide-react";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";

const COMMODITY_ICONS: Record<string, typeof Wheat> = {
  cocoa: Wheat,
  gold: Gem,
  oil_brent: Fuel,
  oil_wti: Fuel,
};

const COMMODITY_LABELS: Record<string, string> = {
  cocoa: "Cocoa",
  gold: "Gold",
  oil_brent: "Brent Crude Oil",
  oil_wti: "WTI Crude Oil",
};

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  GHS: "🇬🇭",
};

const CommodityTracker = () => {
  const navigate = useNavigate();

  usePageMeta({
    title: "Commodity & Currency Tracker | StatsGH",
    description:
      "Live commodity prices and exchange rates impacting Ghana's economy. Track cocoa, gold, oil, and cedi rates.",
    ogType: "website",
  });

  const { data: commodities, isLoading: commoditiesLoading } = useQuery({
    queryKey: ["commodity-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commodity_prices")
        .select("*")
        .order("commodity", { ascending: true });
      if (error) throw error;
      // Get latest per commodity
      const latest: Record<string, typeof data[0]> = {};
      data.forEach((item) => {
        if (!latest[item.commodity] || new Date(item.fetched_at!) > new Date(latest[item.commodity].fetched_at!)) {
          latest[item.commodity] = item;
        }
      });
      return Object.values(latest);
    },
  });

  const { data: currencies, isLoading: currenciesLoading } = useQuery({
    queryKey: ["currency-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currency_rates")
        .select("*")
        .eq("target_currency", "GHS")
        .order("base_currency", { ascending: true });
      if (error) throw error;
      // Get latest per pair
      const latest: Record<string, typeof data[0]> = {};
      data.forEach((item) => {
        const key = `${item.base_currency}_${item.target_currency}`;
        if (!latest[key] || new Date(item.fetched_at!) > new Date(latest[key].fetched_at!)) {
          latest[key] = item;
        }
      });
      return Object.values(latest);
    },
  });

  const { data: gseStocks } = useQuery({
    queryKey: ["gse-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gse_stocks")
        .select("symbol, name, current_price, change_percent")
        .order("market_cap", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const renderChange = (change: number | null) => {
    if (change === null || change === undefined) return <Minus size={14} className="text-muted-foreground" />;
    const isPositive = change >= 0;
    return (
      <span className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {isPositive ? "+" : ""}{change.toFixed(2)}%
      </span>
    );
  };

  const isLoading = commoditiesLoading || currenciesLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/dashboards")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboards
        </Button>

        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">Live</Badge>
            <Badge variant="outline">Markets</Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
            Commodity & Currency Tracker
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Track global commodity prices and exchange rates that impact Ghana's economy. 
            Updated automatically from free public data sources.
          </p>
        </header>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : (
          <>
            {/* Currency Rates */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
                <DollarSign size={20} />
                Exchange Rates (to GHS)
              </h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {currencies && currencies.length > 0 ? currencies.map((rate) => (
                  <Card key={rate.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {CURRENCY_FLAGS[rate.base_currency ?? ""] || "🌐"} {rate.base_currency} → {CURRENCY_FLAGS[rate.target_currency ?? ""]} {rate.target_currency}
                          </p>
                          <p className="text-2xl font-bold mt-1">
                            GHS {Number(rate.rate).toFixed(4)}
                          </p>
                        </div>
                        {renderChange(rate.change_percent ? Number(rate.change_percent) : null)}
                      </div>
                      {rate.fetched_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(rate.fetched_at), "d MMM yyyy, HH:mm")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )) : (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <RefreshCw size={24} className="mx-auto mb-2 opacity-50" />
                      <p>Currency data will appear after the next automated refresh.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

            {/* Commodity Prices */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe size={20} />
                Global Commodity Prices
              </h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {commodities && commodities.length > 0 ? commodities.map((commodity) => {
                  const Icon = COMMODITY_ICONS[commodity.commodity] || Globe;
                  return (
                    <Card key={commodity.id} className="hover:border-primary/30 transition-colors">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Icon size={14} />
                              {COMMODITY_LABELS[commodity.commodity] || commodity.commodity}
                            </p>
                            <p className="text-2xl font-bold mt-1">
                              ${Number(commodity.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                            {commodity.unit && (
                              <p className="text-xs text-muted-foreground">
                                per {commodity.unit.replace("per_", "")}
                              </p>
                            )}
                          </div>
                          {renderChange(commodity.change_percent ? Number(commodity.change_percent) : null)}
                        </div>
                        {commodity.fetched_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(commodity.fetched_at), "d MMM yyyy, HH:mm")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                }) : (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <RefreshCw size={24} className="mx-auto mb-2 opacity-50" />
                      <p>Commodity data will appear after the next automated refresh.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

            {/* GSE Top Movers */}
            {gseStocks && gseStocks.length > 0 && (
              <section className="mb-10">
                <h2 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp size={20} />
                  GSE Top Stocks
                </h2>
                <Card>
                  <CardContent className="pt-4">
                    <div className="divide-y">
                      {gseStocks.map((stock) => (
                        <div key={stock.symbol} className="flex items-center justify-between py-3">
                          <div>
                            <p className="font-semibold text-sm">{stock.symbol}</p>
                            <p className="text-xs text-muted-foreground">{stock.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold">GHS {Number(stock.current_price).toFixed(2)}</p>
                            {renderChange(stock.change_percent ? Number(stock.change_percent) : null)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full mt-2"
                      onClick={() => navigate("/dashboards/gse")}
                    >
                      View Full GSE Dashboard →
                    </Button>
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}

        {/* About */}
        <Card>
          <CardContent className="py-6">
            <h3 className="font-serif font-semibold mb-2">About This Tracker</h3>
            <p className="text-sm text-muted-foreground">
              Commodity prices and exchange rates are fetched automatically from free public APIs 
              including the World Bank Commodity API, Open Exchange Rates, and Bank of Ghana. 
              Data is refreshed every 6 hours. For historical exchange rate data, visit the{" "}
              <button
                onClick={() => navigate("/data/exchange-rate-ghs-usd")}
                className="text-primary hover:underline"
              >
                USD/GHS indicator page
              </button>.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CommodityTracker;
