"use client";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, TrendingUp, Newspaper } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TopicDashboard = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Fetch topic details
  const { data: topic, isLoading: topicLoading } = useQuery({
    queryKey: ["topic", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_topics")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch indicators for this topic
  const { data: indicators } = useQuery({
    queryKey: ["topic-indicators", topic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select(`
          id, name, slug, short_name, description, unit, is_ghana_core, priority_tier
        `)
        .eq("topic_id", topic!.id)
        .order("priority_tier")
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!topic?.id,
  });

  // Fetch Ghana data for key indicators (Ghana national series)
  const { data: keyIndicatorData } = useQuery({
    queryKey: ["topic-key-data", topic?.id],
    queryFn: async () => {
      if (!indicators || indicators.length === 0) return [];

      // Get top 6 indicators by priority
      const topIndicators = indicators.slice(0, 6);
      
      const results = await Promise.all(
        topIndicators.map(async (ind) => {
          // Get Ghana series
          const { data: seriesData } = await supabase
            .from("data_series")
            .select(`
              id,
              geography:geographies(is_ghana)
            `)
            .eq("indicator_id", ind.id)
            .eq("is_primary", true);

          const ghanaSeries = seriesData?.find((s: any) => s.geography?.is_ghana);
          
          if (!ghanaSeries) return null;

          // Get latest data points
          const { data: points } = await supabase
            .from("data_points")
            .select("date, value")
            .eq("series_id", ghanaSeries.id)
            .order("date", { ascending: true })
            .limit(24);

          return {
            indicator: ind,
            data: points || [],
          };
        })
      );

      return results.filter(Boolean);
    },
    enabled: !!indicators && indicators.length > 0,
  });

  // Fetch related news articles
  const { data: relatedArticles } = useQuery({
    queryKey: ["topic-articles", topic?.id],
    queryFn: async () => {
      // Get articles that link to indicators in this topic
      const { data: linkedArticles } = await supabase
        .from("article_indicators")
        .select(`
          article:articles(id, title, slug, summary, published_at, category_slug)
        `)
        .in("indicator_id", indicators!.map((i) => i.id))
        .limit(5);

      if (linkedArticles && linkedArticles.length > 0) {
        return linkedArticles.map((la: any) => la.article).filter(Boolean);
      }

      // Fallback: get recent articles from related category
      const { data: articles } = await supabase
        .from("articles")
        .select("id, title, slug, summary, published_at, category_slug")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(5);

      return articles || [];
    },
    enabled: !!indicators && indicators.length > 0,
  });

  if (topicLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-full max-w-lg mb-8" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Topic not found</h1>
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
          Back to Data
        </Button>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-bold mb-2">{topic.name}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {topic.description || `Explore Ghana's ${topic.name.toLowerCase()} data and indicators.`}
          </p>
        </div>

        {/* Ghana Snapshot */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-2xl font-bold">Ghana Snapshot</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {keyIndicatorData?.map((item: any) => {
              if (!item) return null;
              const { indicator, data } = item;
              const latestValue = data[data.length - 1];
              const chartData = data.map((d: any) => ({
                date: new Date(d.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
                value: d.value,
              }));

              return (
                <Card 
                  key={indicator.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/data/${indicator.slug}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {indicator.short_name || indicator.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {latestValue ? (
                      <>
                        <p className="text-2xl font-bold mb-2">
                          {latestValue.value.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {indicator.unit}
                          </span>
                        </p>
                        {chartData.length > 1 && (
                          <div className="h-16 mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* All Indicators */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold mb-6">All Indicators</h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {indicators?.map((indicator) => (
              <Card
                key={indicator.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/data/${indicator.slug}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium leading-tight">{indicator.name}</h3>
                    <div className="flex gap-1 ml-2">
                      {indicator.is_ghana_core && (
                        <Badge variant="default" className="text-xs">Ghana</Badge>
                      )}
                      {indicator.priority_tier === "tier1" && (
                        <Badge variant="secondary" className="text-xs">Priority</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {indicator.description || "View data and trends"}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <span>Unit: {indicator.unit}</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!indicators || indicators.length === 0) && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No indicators available for this topic yet.
              </p>
            </Card>
          )}
        </section>

        {/* Related News */}
        {relatedArticles && relatedArticles.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Newspaper className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-serif text-2xl font-bold">Related Stories</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {relatedArticles.map((article: any) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
                >
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">{article.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(article.published_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default TopicDashboard;
