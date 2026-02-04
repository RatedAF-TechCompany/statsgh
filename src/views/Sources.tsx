"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Building2, Globe } from "lucide-react";

const Sources = () => {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_sources")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Group sources by type
  const ghanaSources = sources?.filter((s) => s.is_ghana_source) || [];
  const internationalSources = sources?.filter((s) => !s.is_ghana_source) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            Data Sources
          </h1>
          <p className="text-muted-foreground text-lg">
            StatsGH draws on official statistical agencies and reputable international organisations. 
            All data points are linked to their primary sources.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Ghana Sources */}
            <section className="mb-10">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building2 size={20} />
                Ghana Official Sources
              </h2>
              <div className="grid gap-4">
                {ghanaSources.length > 0 ? (
                  ghanaSources.map((source) => (
                    <Card key={source.id} className="hover:border-primary/30 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {source.logo_url ? (
                              <img
                                src={source.logo_url}
                                alt={source.name}
                                className="h-10 w-10 object-contain rounded"
                              />
                            ) : (
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                                <Building2 size={20} className="text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <CardTitle className="text-base">{source.name}</CardTitle>
                              {source.short_name && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {source.short_name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {source.website_url && (
                            <a
                              href={source.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-sm"
                            >
                              Visit <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {source.description && (
                          <CardDescription>{source.description}</CardDescription>
                        )}
                        {source.source_type && (
                          <Badge variant="secondary" className="mt-2 text-xs capitalize">
                            {source.source_type}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <GhanaSourcesPlaceholder />
                )}
              </div>
            </section>

            {/* International Sources */}
            <section>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Globe size={20} />
                International Sources
              </h2>
              <div className="grid gap-4">
                {internationalSources.length > 0 ? (
                  internationalSources.map((source) => (
                    <Card key={source.id} className="hover:border-primary/30 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {source.logo_url ? (
                              <img
                                src={source.logo_url}
                                alt={source.name}
                                className="h-10 w-10 object-contain rounded"
                              />
                            ) : (
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                                <Globe size={20} className="text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <CardTitle className="text-base">{source.name}</CardTitle>
                              {source.short_name && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {source.short_name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {source.website_url && (
                            <a
                              href={source.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-sm"
                            >
                              Visit <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {source.description && (
                          <CardDescription>{source.description}</CardDescription>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <InternationalSourcesPlaceholder />
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

// Placeholder for when no sources are in DB yet
const GhanaSourcesPlaceholder = () => (
  <div className="grid gap-4">
    {[
      { name: "Ghana Statistical Service (GSS)", description: "Official national statistics agency for census, surveys, and economic indicators." },
      { name: "Bank of Ghana (BoG)", description: "Central bank data on monetary policy, exchange rates, and financial sector indicators." },
      { name: "Ministry of Finance", description: "Government budget, revenue, expenditure, and public debt data." },
      { name: "Ghana Revenue Authority (GRA)", description: "Tax revenue and customs data." },
    ].map((source, i) => (
      <Card key={i} className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{source.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>{source.description}</CardDescription>
        </CardContent>
      </Card>
    ))}
  </div>
);

const InternationalSourcesPlaceholder = () => (
  <div className="grid gap-4">
    {[
      { name: "World Bank", description: "World Development Indicators and global economic data." },
      { name: "International Monetary Fund (IMF)", description: "Global financial and economic data, World Economic Outlook." },
      { name: "United Nations (UN)", description: "SDG indicators, population, and development statistics." },
      { name: "African Development Bank (AfDB)", description: "African economic data and development indicators." },
    ].map((source, i) => (
      <Card key={i} className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{source.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>{source.description}</CardDescription>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default Sources;
