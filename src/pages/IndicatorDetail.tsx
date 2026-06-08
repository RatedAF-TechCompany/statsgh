import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Download,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Calendar,
  Database,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { usePageMeta } from "@/hooks/usePageMeta";

interface DataPoint {
  id: string;
  date: string;
  value: number;
  value_formatted: string | null;
  source_note: string | null;
  is_estimate: boolean;
  is_provisional: boolean;
}

interface Series {
  id: string;
  name: string | null;
  breakdown_type: string | null;
  breakdown_value: string | null;
  is_primary: boolean;
  geography: {
    id: string;
    name: string;
    code: string | null;
    is_ghana: boolean;
  };
}

const IndicatorDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [selectedGeography, setSelectedGeography] = useState<string | null>(null);

  // Fetch indicator details
  const { data: indicator, isLoading: indicatorLoading } = useQuery({
    queryKey: ["indicator", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select(`
          *,
          topic:data_topics(id, name, slug),
          default_geography:geographies!indicators_default_geography_id_fkey(id, name, code)
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const indicatorMissing = !indicatorLoading && !indicator;

  // Fetch available series for this indicator
  const { data: series } = useQuery({
    queryKey: ["indicator-series", indicator?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_series")
        .select(`
          id, name, breakdown_type, breakdown_value, is_primary,
          geography:geographies(id, name, code, is_ghana)
        `)
        .eq("indicator_id", indicator!.id);

      if (error) throw error;
      
      // Sort to put Ghana first
      return (data as Series[]).sort((a, b) => {
        if (a.geography?.is_ghana && !b.geography?.is_ghana) return -1;
        if (!a.geography?.is_ghana && b.geography?.is_ghana) return 1;
        return 0;
      });
    },
    enabled: !!indicator?.id,
  });

  // Get the active series (Ghana first, or selected)
  const activeSeries = series?.find((s) => 
    selectedGeography ? s.geography?.id === selectedGeography : s.geography?.is_ghana && s.is_primary
  ) || series?.[0];

  // Fetch data points for the active series
  const { data: dataPoints, isLoading: dataLoading } = useQuery({
    queryKey: ["data-points", activeSeries?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_points")
        .select("*")
        .eq("series_id", activeSeries!.id)
        .order("date", { ascending: true });

      if (error) throw error;
      return data as DataPoint[];
    },
    enabled: !!activeSeries?.id,
  });

  // Calculate change metrics
  const latestValue = dataPoints?.[dataPoints.length - 1];
  const previousValue = dataPoints?.[dataPoints.length - 2];
  const changeValue = latestValue && previousValue 
    ? latestValue.value - previousValue.value 
    : null;
  const changePercent = latestValue && previousValue && previousValue.value !== 0
    ? ((latestValue.value - previousValue.value) / previousValue.value) * 100
    : null;

  // Format chart data
  const chartData = dataPoints?.map((dp) => ({
    date: new Date(dp.date).toLocaleDateString("en-GB", { 
      year: "numeric", 
      month: "short" 
    }),
    value: dp.value,
    fullDate: dp.date,
  })) || [];

  // CSV Download
  const handleDownloadCSV = () => {
    if (!dataPoints || !indicator) return;

    const headers = ["Date", "Value", "Unit", "Source Note", "Is Estimate", "Is Provisional"];
    const rows = dataPoints.map((dp) => [
      dp.date,
      dp.value,
      indicator.unit,
      dp.source_note || "",
      dp.is_estimate ? "Yes" : "No",
      dp.is_provisional ? "Yes" : "No",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${indicator.slug}-${activeSeries?.geography?.code || "data"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  usePageMeta({
    title: indicatorMissing
      ? "Indicator not found | StatsGH"
      : indicator?.name ? `${indicator.name} — Ghana Data | StatsGH`.slice(0, 60) : undefined,
    description: indicator
      ? (indicator.description || `Live data and historical chart for ${indicator.name} in Ghana.`).slice(0, 158)
      : undefined,
    robots: indicatorMissing ? "noindex, follow" : undefined,
    jsonLd: indicator
      ? {
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: indicator.name,
          description: indicator.description || `Ghana indicator: ${indicator.name}`,
          creator: { "@type": "Organization", name: "StatsGH" },
          keywords: ["Ghana", indicator.name, indicator.topic?.name].filter(Boolean),
          measurementTechnique: indicator.unit || undefined,
        }
      : undefined,
  });


  if (indicatorLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-12 w-full max-w-xl mb-8" />
          <Skeleton className="h-80 w-full" />
        </main>
      </div>
    );
  }

  if (!indicator) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Indicator not found</h1>
          <Button onClick={() => navigate("/data")}>Back to Indicators</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />




      <main className="container mx-auto px-4 py-8">
        {/* Navigation */}
        <Button
          variant="ghost"
          onClick={() => navigate("/data")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Indicators
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {indicator.topic && (
                  <Badge variant="outline">{indicator.topic.name}</Badge>
                )}
                {indicator.is_ghana_core && (
                  <Badge variant="default">Ghana Core</Badge>
                )}
                {indicator.priority_tier === "tier1" && (
                  <Badge variant="secondary">Priority</Badge>
                )}
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">
                {indicator.name}
              </h1>
              <p className="text-muted-foreground text-lg">
                {indicator.description}
              </p>
            </div>
            <Button onClick={handleDownloadCSV} disabled={!dataPoints?.length}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </div>

        {/* Key Stats */}
        {latestValue && (
          <section aria-labelledby="key-stats-heading" className="mb-8">
          <h2 id="key-stats-heading" className="sr-only">Key Statistics</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Latest Value ({activeSeries?.geography?.name || "Ghana"})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {latestValue.value_formatted || latestValue.value.toLocaleString()}
                  <span className="text-lg font-normal text-muted-foreground ml-1">
                    {indicator.unit}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground flex items-center mt-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(latestValue.date).toLocaleDateString("en-GB", {
                    year: "numeric",
                    month: "long",
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Change from Previous
                </CardTitle>
              </CardHeader>
              <CardContent>
                {changeValue !== null ? (
                  <div className="flex items-center gap-2">
                    {changeValue > 0 ? (
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    ) : changeValue < 0 ? (
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    ) : (
                      <Minus className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className={`text-2xl font-bold ${
                      changeValue > 0 ? "text-green-600" : changeValue < 0 ? "text-red-600" : ""
                    }`}>
                      {changeValue > 0 ? "+" : ""}{changeValue.toLocaleString(undefined, {
                        maximumFractionDigits: indicator.decimal_places || 2,
                      })}
                    </span>
                    {changePercent !== null && (
                      <span className="text-muted-foreground">
                        ({changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No comparison available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Data Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {dataPoints?.length || 0} data points
                </p>
                {dataPoints && dataPoints.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {new Date(dataPoints[0].date).getFullYear()} – {new Date(dataPoints[dataPoints.length - 1].date).getFullYear()}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          </section>
        )}

        {/* Geography Selector */}
        {series && series.length > 1 && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Select Geography</label>
            <Select
              value={selectedGeography || activeSeries?.geography?.id || ""}
              onValueChange={setSelectedGeography}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select geography" />
              </SelectTrigger>
              <SelectContent>
                {series.map((s) => (
                  <SelectItem key={s.id} value={s.geography?.id || s.id}>
                    {s.geography?.name || "Unknown"} {s.geography?.is_ghana && "(Ghana)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {indicator.name} – {activeSeries?.geography?.name || "Ghana"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toLocaleString()} ${indicator.unit}`,
                      indicator.name,
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={activeSeries?.geography?.name || "Ghana"}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No data available for this indicator yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Details */}
        <Tabs defaultValue="definition" className="mb-8">
          <TabsList>
            <TabsTrigger value="definition">Definition</TabsTrigger>
            <TabsTrigger value="methodology">Methodology</TabsTrigger>
            <TabsTrigger value="data">Data Table</TabsTrigger>
          </TabsList>

          <TabsContent value="definition" className="mt-4">
            <Card>
              <CardContent className="pt-6 prose prose-sm max-w-none">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Info className="h-4 w-4" />
                  Definition
                </h2>
                <p>{indicator.definition || "Definition not yet available."}</p>

                {indicator.caveats && (
                  <>
                    <h2 className="text-lg font-semibold">Caveats and Limitations</h2>
                    <p>{indicator.caveats}</p>
                  </>
                )}

                <div className="not-prose mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Unit of Measurement</p>
                    <p className="font-medium">{indicator.unit_display || indicator.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Frequency</p>
                    <p className="font-medium capitalize">{indicator.frequency || "Varies"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="methodology" className="mt-4">
            <Card>
              <CardContent className="pt-6 prose prose-sm max-w-none">
                <h2 className="text-lg font-semibold">Methodology</h2>
                <p>{indicator.methodology || "Methodology documentation not yet available."}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Date</th>
                        <th className="text-right py-2 px-4">Value</th>
                        <th className="text-left py-2 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataPoints?.slice().reverse().slice(0, 20).map((dp) => (
                        <tr key={dp.id} className="border-b">
                          <td className="py-2 px-4">
                            {new Date(dp.date).toLocaleDateString("en-GB", {
                              year: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="text-right py-2 px-4 font-mono">
                            {dp.value_formatted || dp.value.toLocaleString()}
                            <span className="text-muted-foreground ml-1">{indicator.unit}</span>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              {dp.is_estimate && <Badge variant="outline">Estimate</Badge>}
                              {dp.is_provisional && <Badge variant="outline">Provisional</Badge>}
                              {dp.source_note && (
                                <span className="text-muted-foreground text-xs">{dp.source_note}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dataPoints && dataPoints.length > 20 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing 20 most recent values. Download CSV for complete data.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default IndicatorDetail;
