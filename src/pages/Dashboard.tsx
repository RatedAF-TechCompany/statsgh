import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import {
  PlusCircle,
  FileText,
  Eye,
  Clock,
  TrendingUp,
  Users,
  Settings,
  Image,
  FolderOpen,
  Tag,
  BarChart3,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
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

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [published, drafts, scheduled, views] = await Promise.all([
        supabase.from("articles").select("*", { count: "exact" }).eq("status", "published"),
        supabase.from("articles").select("*", { count: "exact" }).eq("status", "draft"),
        supabase.from("articles").select("*", { count: "exact" }).not("scheduled_at", "is", null),
        supabase.from("article_views").select("*", { count: "exact" }),
      ]);

      return {
        published: published.count || 0,
        drafts: drafts.count || 0,
        scheduled: scheduled.count || 0,
        views: views.count || 0,
      };
    },
    enabled: !!session?.user?.id,
  });

  const { data: recentArticles } = useQuery({
    queryKey: ["recent-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, title, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return data;
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
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-serif text-3xl font-bold">Dashboard</h1>
          <Button onClick={() => navigate("/admin/articles/new")}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Article
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.published || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.drafts || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.scheduled || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.views || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/articles")}>
            <CardHeader>
              <FileText className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage all your articles
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/media")}>
            <CardHeader>
              <Image className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Media Library</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upload and manage images
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/categories")}>
            <CardHeader>
              <FolderOpen className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Organize content by category
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/analytics")}>
            <CardHeader>
              <TrendingUp className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View performance metrics
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/users")}>
            <CardHeader>
              <Users className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage team members
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/audit-log")}>
            <CardHeader>
              <ScrollText className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View system activity
              </p>
            </CardContent>
          </Card>

          <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("/admin/settings")}>
            <CardHeader>
              <Settings className="h-8 w-8 mb-2 text-accent" />
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure your site
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Articles</CardTitle>
          </CardHeader>
          <CardContent>
            {recentArticles && recentArticles.length > 0 ? (
              <div className="space-y-4">
                {recentArticles.map((article) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/articles/${article.id}`)}
                  >
                    <div>
                      <h3 className="font-medium">{article.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(article.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent">
                      {article.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No articles yet</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;