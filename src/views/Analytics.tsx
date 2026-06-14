"use client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { AnalyticsSummaryCards } from "@/components/analytics/AnalyticsSummaryCards";
import { TrafficChart } from "@/components/analytics/TrafficChart";
import { TopArticlesTable } from "@/components/analytics/TopArticlesTable";
import { DeviceBreakdown } from "@/components/analytics/DeviceBreakdown";
import { TrafficSources } from "@/components/analytics/TrafficSources";
import { HourlyTraffic } from "@/components/analytics/HourlyTraffic";
import { CategoryPerformance } from "@/components/analytics/CategoryPerformance";
import { format } from "date-fns";

const Analytics = () => {
  const navigate = useNavigate();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isAdmin, isLoading: isLoadingAuth } = useQuery({
    queryKey: ["isAdmin", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  const {
    totalViews,
    todayViews,
    weekViews,
    lastWeekViews,
    uniqueVisitors,
    dailyViews,
    topArticles,
    deviceBreakdown,
    trafficSources,
    hourlyTraffic,
    categoryPerformance,
  } = useAnalyticsData(isAdmin === true, session?.user?.id);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    }
  }, [session, isLoadingAuth, navigate]);

  if (!session || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-muted-foreground">You don't have access to analytics.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="font-serif text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Last updated: {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <AnalyticsSummaryCards
          totalViews={totalViews}
          todayViews={todayViews}
          weekViews={weekViews}
          lastWeekViews={lastWeekViews}
          uniqueVisitors={uniqueVisitors}
        />

        {/* Traffic Chart - Full Width */}
        <div className="mt-6">
          <TrafficChart data={dailyViews} title="Traffic (Last 14 Days)" />
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <TopArticlesTable articles={topArticles as any} />
          <div className="space-y-6">
            <DeviceBreakdown data={deviceBreakdown} />
            <HourlyTraffic data={hourlyTraffic} />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <TrafficSources data={trafficSources} />
          <CategoryPerformance data={categoryPerformance} />
        </div>
      </main>
    </div>
  );
};

export default Analytics;
