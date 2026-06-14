"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, TrendingUp, Database, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Indicator {
  id: string;
  name: string;
  slug: string;
  short_name: string | null;
  description: string | null;
  unit: string;
  frequency: string | null;
  priority_tier: string | null;
  is_ghana_core: boolean;
  topic: {
    name: string;
    slug: string;
  } | null;
}

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  indicator_count: number;
}

const DataIndicators = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ["data-topics"],
    queryFn: async () => {
      const { data: topicsData, error: topicsError } = await supabase
        .from("data_topics")
        .select("id, name, slug, description")
        .order("display_order");

      if (topicsError) throw topicsError;

      // Get indicator counts per topic
      const { data: counts, error: countsError } = await supabase
        .from("indicators")
        .select("topic_id");

      if (countsError) throw countsError;

      const countMap = (counts || []).reduce((acc: Record<string, number>, item) => {
        if (item.topic_id) {
          acc[item.topic_id] = (acc[item.topic_id] || 0) + 1;
        }
        return acc;
      }, {});

      return (topicsData || []).map((topic) => ({
        ...topic,
        indicator_count: countMap[topic.id] || 0,
      })) as Topic[];
    },
  });

  const { data: indicators, isLoading: indicatorsLoading } = useQuery({
    queryKey: ["indicators", selectedTopic, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("indicators")
        .select(`
          id, name, slug, short_name, description, unit, frequency, priority_tier, is_ghana_core,
          topic:data_topics(name, slug)
        `)
        .order("name");

      if (selectedTopic) {
        query = query.eq("topic_id", selectedTopic);
      }

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Indicator[];
    },
  });

  const ghanaIndicators = indicators?.filter((i) => i.is_ghana_core) || [];
  const otherIndicators = indicators?.filter((i) => !i.is_ghana_core) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-bold mb-2">Ghana Data Indicators</h1>
          <p className="text-muted-foreground text-lg">
            Explore verified statistics on Ghana's economy, society, and development. Every number has a source.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search indicators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {/* Topic Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={selectedTopic === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTopic(null)}
          >
            All Topics
          </Button>
          {topicsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))
          ) : (
            topics?.map((topic) => (
              <Button
                key={topic.id}
                variant={selectedTopic === topic.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTopic(topic.id)}
              >
                {topic.name}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {topic.indicator_count}
                </Badge>
              </Button>
            ))
          )}
        </div>

        {/* Ghana Core Indicators */}
        {ghanaIndicators.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-2xl font-bold">Ghana Core Indicators</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ghanaIndicators.map((indicator) => (
                <Card
                  key={indicator.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/data/${indicator.slug}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">
                        {indicator.name}
                      </CardTitle>
                      <Badge variant="default" className="ml-2 shrink-0">
                        Ghana
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {indicator.description || "No description available"}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Unit: {indicator.unit}
                      </span>
                      {indicator.topic && (
                        <Badge variant="outline">{indicator.topic.name}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* All Indicators */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-serif text-2xl font-bold">
              {selectedTopic ? "Filtered Indicators" : "All Indicators"}
            </h2>
          </div>

          {indicatorsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : otherIndicators.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherIndicators.map((indicator) => (
                <Card
                  key={indicator.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/data/${indicator.slug}`)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg leading-tight">
                      {indicator.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {indicator.description || "No description available"}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Unit: {indicator.unit}
                      </span>
                      {indicator.topic && (
                        <Badge variant="outline">{indicator.topic.name}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No indicators found. {searchQuery && "Try a different search term."}
              </p>
            </Card>
          )}
        </section>

        {/* Topic Explorer */}
        {!selectedTopic && !searchQuery && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl font-bold mb-6">Explore by Topic</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topics?.slice(0, 9).map((topic) => (
                <Card
                  key={topic.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/topics/${topic.slug}`)}
                >
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2">{topic.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {topic.description || "Explore data and indicators"}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {topic.indicator_count} indicators
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
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

export default DataIndicators;
