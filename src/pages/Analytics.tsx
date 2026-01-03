import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { ArrowLeft, Eye, TrendingUp } from "lucide-react";
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

  const { data: totalViews } = useQuery({
    queryKey: ["total-views"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("article_views")
        .select("*", { count: "exact", head: true });

      if (error) {
        console.error("Error fetching total views:", error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!session?.user?.id && isAdmin === true,
  });

  const { data: topArticles } = useQuery({
    queryKey: ["top-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("article_id, articles(title)");

      if (error) {
        console.error("Error fetching top articles:", error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Count views per article
      const viewCounts = data.reduce((acc: Record<string, { title: string; views: number }>, view: any) => {
        const articleId = view.article_id;
        const title = view.articles?.title || "Unknown";
        if (!acc[articleId]) {
          acc[articleId] = { title, views: 0 };
        }
        acc[articleId].views += 1;
        return acc;
      }, {});

      return Object.values(viewCounts)
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);
    },
    enabled: !!session?.user?.id && isAdmin === true,
  });

  const { data: deviceBreakdown } = useQuery({
    queryKey: ["device-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("device_type");

      if (error) {
        console.error("Error fetching device breakdown:", error);
        return [];
      }

      if (!data || data.length === 0) return [];

      const breakdown = data.reduce((acc: Record<string, number>, view) => {
        const device = view.device_type || "Unknown";
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(breakdown).map(([device, count]) => ({ device, count }));
    },
    enabled: !!session?.user?.id && isAdmin === true,
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

        {/* Total Views Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Total Article Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalViews?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>

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
                  {topArticles.map((article, index) => (
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
