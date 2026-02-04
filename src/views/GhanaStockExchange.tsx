"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  RefreshCw,
  BarChart3,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

interface GseStock {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  current_price: number;
  previous_close: number | null;
  price_one_month_ago: number | null;
  volume: number | null;
  market_cap: number | null;
  change_percent: number | null;
  month_change_percent: number | null;
  last_updated: string | null;
}

const formatCurrency = (value: number | null): string => {
  if (value === null) return "—";
  return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatVolume = (value: number | null): string => {
  if (value === null) return "—";
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toLocaleString();
};

const formatMarketCap = (value: number | null): string => {
  if (value === null) return "—";
  if (value >= 1000000000) {
    return `GHS ${(value / 1000000000).toFixed(2)}B`;
  }
  if (value >= 1000000) {
    return `GHS ${(value / 1000000).toFixed(0)}M`;
  }
  return formatCurrency(value);
};

const ChangeIndicator = ({ value, label }: { value: number | null; label?: string }) => {
  if (value === null) return <span className="text-muted-foreground">—</span>;

  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div className="flex items-center gap-1">
      {isNeutral ? (
        <Minus size={14} className="text-muted-foreground" />
      ) : isPositive ? (
        <TrendingUp size={14} className="text-green-600" />
      ) : (
        <TrendingDown size={14} className="text-red-500" />
      )}
      <span
        className={`font-medium ${
          isNeutral
            ? "text-muted-foreground"
            : isPositive
            ? "text-green-600"
            : "text-red-500"
        }`}
      >
        {isPositive ? "+" : ""}
        {value.toFixed(2)}%
      </span>
      {label && <span className="text-xs text-muted-foreground ml-1">({label})</span>}
    </div>
  );
};

const GhanaStockExchange = () => {
  const router = useRouter();

  const { data: stocks, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["gse-stocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gse_stocks")
        .select("*")
        .order("market_cap", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as GseStock[];
    },
  });

  // Calculate summary stats
  const summaryStats = stocks
    ? {
        totalMarketCap: stocks.reduce((sum, s) => sum + (s.market_cap || 0), 0),
        avgDailyChange:
          stocks.reduce((sum, s) => sum + (s.change_percent || 0), 0) / stocks.length,
        avgMonthChange:
          stocks.reduce((sum, s) => sum + (s.month_change_percent || 0), 0) / stocks.length,
        gainers: stocks.filter((s) => (s.change_percent || 0) > 0).length,
        losers: stocks.filter((s) => (s.change_percent || 0) < 0).length,
      }
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Navigation */}
        <Button variant="ghost" onClick={() => router.push("/dashboards")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboards
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">Dashboard</Badge>
            <Badge variant="outline">GSE</Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <BarChart3 size={12} />
              Live Data
            </Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
            Ghana Stock Exchange
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Track the latest share prices, trading volumes, and performance metrics for the top
            10 companies listed on the Ghana Stock Exchange.
          </p>
          <div className="flex items-center gap-4 mt-3">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar size={14} />
              Last updated: {dataUpdatedAt ? format(new Date(dataUpdatedAt), "dd MMM yyyy, HH:mm") : "—"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} className="mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summaryStats && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Total Market Cap (Top 10)
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMarketCap(summaryStats.totalMarketCap)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Avg. Daily Change
                </p>
                <ChangeIndicator value={summaryStats.avgDailyChange} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Avg. Monthly Change
                </p>
                <ChangeIndicator value={summaryStats.avgMonthChange} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Gainers / Losers
                </p>
                <p className="text-xl font-bold">
                  <span className="text-green-600">{summaryStats.gainers}</span>
                  <span className="text-muted-foreground mx-2">/</span>
                  <span className="text-red-500">{summaryStats.losers}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stocks Table */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 GSE Stocks</CardTitle>
            <CardDescription>
              Share prices with daily and monthly performance comparison
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Symbol</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Prev. Close</TableHead>
                    <TableHead className="text-right">Price (1M Ago)</TableHead>
                    <TableHead className="text-right">Daily Change</TableHead>
                    <TableHead className="text-right">Monthly Change</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Market Cap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks?.map((stock) => (
                    <TableRow key={stock.id} className="hover:bg-muted/50">
                      <TableCell className="font-bold text-primary">{stock.symbol}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {stock.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {stock.sector || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(stock.current_price)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(stock.previous_close)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(stock.price_one_month_ago)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChangeIndicator value={stock.change_percent} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ChangeIndicator value={stock.month_change_percent} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatVolume(stock.volume)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatMarketCap(stock.market_cap)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-green-600" />
                <span>Price increase</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown size={14} className="text-red-500" />
                <span>Price decrease</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus size={14} className="text-muted-foreground" />
                <span>No change</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Source */}
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Data source: Ghana Stock Exchange • Prices may be delayed up to 15 minutes
        </p>
      </main>
    </div>
  );
};

export default GhanaStockExchange;
