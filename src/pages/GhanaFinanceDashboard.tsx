import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Newspaper,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

interface IndicatorData {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  unit: string;
  unit_display: string | null;
  decimal_places: number | null;
  description: string | null;
  latestValue: number | null;
  previousValue: number | null;
  latestDate: string | null;
  change: number | null;
  changePercent: number | null;
  chartData: { date: string; value: number; formattedDate: string }[];
}

const FINANCE_INDICATOR_SLUGS = [
  "gdp-growth-rate",
  "cpi-inflation",
  "exchange-rate-ghs-usd",
  "policy-rate",
  "public-debt-gdp",
];

// Chart color palette matching design system
const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(142, 76%, 36%)",
  danger: "hsl(0, 84%, 60%)",
  muted: "hsl(var(--muted-foreground))",
};

const formatValue = (value: number | null, unit: string, decimals: number | null): string => {
  if (value === null) return "—";
  const decimalPlaces = decimals ?? 2;

  if (unit === "percent" || unit === "%") {
    return `${value.toFixed(decimalPlaces)}%`;
  }
  if (unit === "currency" || unit === "GHS") {
    return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}`;
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
};

const GhanaFinanceDashboard = () => {
  const navigate = useNavigate();

  // Fetch all finance-related indicators
  const { data: indicators, isLoading } = useQuery({
    queryKey: ["ghana-finance-dashboard"],
    queryFn: async () => {
      // Get Ghana geography
      const { data: ghana } = await supabase
        .from("geographies")
        .select("id")
        .eq("is_ghana", true)
        .single();

      if (!ghana) return [];

      // Get finance indicators
      const { data: financeIndicators, error } = await supabase
        .from("indicators")
        .select("id, name, short_name, slug, unit, unit_display, decimal_places, description")
        .in("slug", FINANCE_INDICATOR_SLUGS);

      if (error || !financeIndicators) return [];

      // For each indicator, get the Ghana series and data
      const indicatorsWithData: IndicatorData[] = await Promise.all(
        financeIndicators.map(async (indicator) => {
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
              chartData: [],
            };
          }

          const { data: dataPoints } = await supabase
            .from("data_points")
            .select("value, date")
            .eq("series_id", series.id)
            .order("date", { ascending: true });

          if (!dataPoints || dataPoints.length === 0) {
            return {
              ...indicator,
              latestValue: null,
              previousValue: null,
              latestDate: null,
              change: null,
              changePercent: null,
              chartData: [],
            };
          }

          const chartData = dataPoints.map((dp) => ({
            date: dp.date,
            value: Number(dp.value),
            formattedDate: format(new Date(dp.date), "MMM yy"),
          }));

          const latest = dataPoints[dataPoints.length - 1];
          const previous = dataPoints.length > 1 ? dataPoints[dataPoints.length - 2] : null;
          const latestValue = Number(latest.value);
          const previousValue = previous ? Number(previous.value) : null;
          const change = previousValue !== null ? latestValue - previousValue : null;
          const changePercent =
            previousValue !== null && previousValue !== 0
              ? ((latestValue - previousValue) / Math.abs(previousValue)) * 100
              : null;

          return {
            ...indicator,
            latestValue,
            previousValue,
            latestDate: latest.date,
            change,
            changePercent,
            chartData,
          };
        })
      );

      return indicatorsWithData;
    },
  });

  // Fetch related news articles
  const { data: relatedNews } = useQuery({
    queryKey: ["finance-dashboard-news"],
    queryFn: async () => {
      // Get recent articles tagged with economy/finance topics
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, published_at, category_slug, hero_image_url")
        .eq("is_published", true)
        .or("tags.cs.{economy},tags.cs.{finance},tags.cs.{gdp},tags.cs.{inflation}")
        .order("published_at", { ascending: false })
        .limit(4);

      if (error) {
        // Fallback to most recent articles
        const { data: fallbackData } = await supabase
          .from("articles")
          .select("id, title, slug, published_at, category_slug, hero_image_url")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(4);
        return fallbackData || [];
      }
      
      return data || [];
    },
  });

  const getIndicatorBySlug = (slug: string): IndicatorData | undefined => {
    return indicators?.find((i) => i.slug === slug);
  };

  const gdp = getIndicatorBySlug("gdp-growth-rate");
  const inflation = getIndicatorBySlug("cpi-inflation");
  const exchangeRate = getIndicatorBySlug("exchange-rate-ghs-usd");
  const policyRate = getIndicatorBySlug("policy-rate");
  const debtGdp = getIndicatorBySlug("public-debt-gdp");

  const renderChangeIndicator = (indicator: IndicatorData | undefined, invertColor = false) => {
    if (!indicator || indicator.change === null) return null;
    
    const isPositive = indicator.change >= 0;
    const displayPositive = invertColor ? !isPositive : isPositive;
    
    return (
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp size={14} className={displayPositive ? "text-green-600" : "text-red-500"} />
        ) : (
          <TrendingDown size={14} className={displayPositive ? "text-green-600" : "text-red-500"} />
        )}
        <span className={`text-sm font-medium ${displayPositive ? "text-green-600" : "text-red-500"}`}>
          {indicator.changePercent !== null
            ? `${indicator.changePercent >= 0 ? "+" : ""}${indicator.changePercent.toFixed(1)}%`
            : `${indicator.change >= 0 ? "+" : ""}${indicator.change.toFixed(indicator.decimal_places || 1)}`}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96 mb-8" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Navigation */}
        <Button variant="ghost" onClick={() => navigate("/data")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Data
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">Dashboard</Badge>
            <Badge variant="outline">Ghana</Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
            Ghana Finance Dashboard
          </h1>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Key macroeconomic indicators tracking Ghana's economic performance, including GDP growth, 
            inflation, exchange rates, monetary policy, and public debt.
          </p>
          {gdp?.latestDate && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <Calendar size={14} />
              Last updated: {format(new Date(gdp.latestDate), "MMMM yyyy")}
            </p>
          )}
        </div>

        {/* Key Metrics Summary */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-8">
          {[gdp, inflation, exchangeRate, policyRate, debtGdp].filter(Boolean).map((indicator) => (
            <Card
              key={indicator!.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/data/${indicator!.slug}`)}
            >
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                  {indicator!.short_name || indicator!.name}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatValue(indicator!.latestValue, indicator!.unit, indicator!.decimal_places)}
                </p>
                {renderChangeIndicator(indicator, indicator!.slug === "cpi-inflation")}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* GDP Growth Chart */}
          {gdp && gdp.chartData.length > 0 && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">{gdp.name}</CardTitle>
                <CardDescription>{gdp.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={gdp.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, "GDP Growth"]}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Bar
                      dataKey="value"
                      fill={CHART_COLORS.primary}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/data/${gdp.slug}`)}>
                    View Details <ExternalLink size={14} className="ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inflation Chart */}
          {inflation && inflation.chartData.length > 0 && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">{inflation.name}</CardTitle>
                <CardDescription>{inflation.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={inflation.chartData}>
                    <defs>
                      <linearGradient id="inflationGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.danger} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.danger} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, "Inflation"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.danger}
                      fill="url(#inflationGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/data/${inflation.slug}`)}>
                    View Details <ExternalLink size={14} className="ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exchange Rate Chart */}
          {exchangeRate && exchangeRate.chartData.length > 0 && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">{exchangeRate.name}</CardTitle>
                <CardDescription>{exchangeRate.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={exchangeRate.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₵${v.toFixed(2)}`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`GHS ${value.toFixed(4)}`, "Rate"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.accent}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS.accent }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/data/${exchangeRate.slug}`)}>
                    View Details <ExternalLink size={14} className="ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Policy Rate Chart */}
          {policyRate && policyRate.chartData.length > 0 && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">{policyRate.name}</CardTitle>
                <CardDescription>{policyRate.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={policyRate.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, "Policy Rate"]}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="value"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS.primary }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/data/${policyRate.slug}`)}>
                    View Details <ExternalLink size={14} className="ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Public Debt Chart - Full Width */}
          {debtGdp && debtGdp.chartData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{debtGdp.name}</CardTitle>
                <CardDescription>{debtGdp.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={debtGdp.chartData}>
                    <defs>
                      <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, "Debt/GDP"]}
                    />
                    <ReferenceLine
                      y={60}
                      stroke={CHART_COLORS.danger}
                      strokeDasharray="5 5"
                      label={{ value: "IMF Threshold (60%)", position: "right", fontSize: 11, fill: CHART_COLORS.danger }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.primary}
                      fill="url(#debtGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/data/${debtGdp.slug}`)}>
                    View Details <ExternalLink size={14} className="ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Related News */}
        {relatedNews && relatedNews.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
                <Newspaper size={20} />
                Related Stories
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/search?q=economy")}>
                View All
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {relatedNews.map((article) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                  onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
                >
                  {article.hero_image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={article.hero_image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <Badge variant="outline" className="mb-2 text-xs">
                      {article.category_slug}
                    </Badge>
                    <h3 className="font-medium text-sm line-clamp-2">{article.title}</h3>
                    {article.published_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(article.published_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Methodology Note */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">About This Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              This dashboard presents key macroeconomic indicators for Ghana sourced from official 
              statistical agencies including the Ghana Statistical Service (GSS), Bank of Ghana (BoG), 
              and Ministry of Finance. Data is updated as new releases become available. For detailed 
              methodology and data sources, click on individual indicators.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default GhanaFinanceDashboard;
