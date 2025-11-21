import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { ArrowLeft, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
      // In preview/development, assume all authenticated users are admin
      return true;
    },
    enabled: !!session?.user?.id,
  });

  const { data: topArticles } = useQuery({
    queryKey: ["top-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("article_views")
        .select("article_id, articles(title)")
        .limit(10);

      if (!data) return [];

      // Count views per article
      const viewCounts = data.reduce((acc: any, view: any) => {
        const title = view.articles?.title || "Unknown";
        acc[title] = (acc[title] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(viewCounts)
        .map(([title, views]) => ({ title, views }))
        .sort((a: any, b: any) => b.views - a.views)
        .slice(0, 5);
    },
    enabled: !!session?.user?.id,
  });

  const { data: deviceBreakdown } = useQuery({
    queryKey: ["device-breakdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("article_views")
        .select("device_type")
        .limit(1000);

      if (!data) return [];

      const breakdown = data.reduce((acc: any, view) => {
        const device = view.device_type || "Unknown";
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(breakdown).map(([device, count]) => ({ device, count }));
    },
    enabled: !!session?.user?.id,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    }
  }, [session, isLoadingAuth, navigate]);

  if (!session || isLoadingAuth) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="font-serif text-3xl font-bold">Analytics</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Most Viewed Articles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topArticles && topArticles.length > 0 ? (
                <div className="space-y-4">
                  {topArticles.map((article: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm truncate flex-1">{article.title}</span>
                      <span className="text-sm font-semibold ml-4">{article.views} views</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Device Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deviceBreakdown && deviceBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={deviceBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="device" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Views Per Day (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Daily analytics data coming soon. Track views, engagement, and traffic sources over time.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analytics;