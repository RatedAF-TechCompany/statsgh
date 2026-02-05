import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Newspaper, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  FileText,
  ExternalLink,
  ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { AspectRatio } from "@/components/ui/aspect-ratio";

type NewsroomRun = {
  id: string;
  started_at: string;
  completed_at: string | null;
  trigger_type: string;
  status: string;
  articles_found: number;
  articles_created: number;
  error_message: string | null;
};

type NewsroomArticle = {
  id: string;
  run_id: string;
  source_name: string;
  original_headline: string;
  processing_status: string;
  generated_article_id: string | null;
  image_style: string | null;
  created_at: string;
};

type GeneratedArticle = {
  id: string;
  title: string;
  hero_image_url: string | null;
  slug: string;
  section: string;
};

export default function AdminNewsroom() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Check auth and admin status
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["isAdmin", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["admin", "editor"])
        .limit(1);
      return data && data.length > 0;
    },
    enabled: !!session?.user?.id,
  });

  // Fetch newsroom runs
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["newsroom-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsroom_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as NewsroomRun[];
    },
    enabled: !!isAdmin,
    refetchInterval: 10000, // Refetch every 10 seconds to see running status
  });

  // Fetch articles for selected run with generated article data
  const { data: runArticles } = useQuery({
    queryKey: ["newsroom-articles", selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const { data, error } = await supabase
        .from("newsroom_articles")
        .select("*")
        .eq("run_id", selectedRunId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NewsroomArticle[];
    },
    enabled: !!selectedRunId && !!isAdmin,
  });

  // Fetch generated articles with images for completed newsroom articles
  const generatedArticleIds = runArticles
    ?.filter(a => a.generated_article_id)
    .map(a => a.generated_article_id) || [];

  const { data: generatedArticles } = useQuery({
    queryKey: ["generated-articles", generatedArticleIds],
    queryFn: async () => {
      if (generatedArticleIds.length === 0) return {};
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, hero_image_url, slug, section")
        .in("id", generatedArticleIds);
      if (error) throw error;
      // Return as a map for easy lookup
      const articleMap: Record<string, GeneratedArticle> = {};
      data?.forEach(article => {
        articleMap[article.id] = article as GeneratedArticle;
      });
      return articleMap;
    },
    enabled: generatedArticleIds.length > 0,
  });

  // Trigger manual scan
  const scanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("newsroom-scan", {
        body: { 
          triggerType: "manual",
          userId: session?.user?.id 
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Newsroom Scan Complete",
        description: data.message || `Created ${data.articles_created} articles`,
      });
      queryClient.invalidateQueries({ queryKey: ["newsroom-runs"] });
      if (data.run_id) {
        setSelectedRunId(data.run_id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fast publish backfill: publish recent items from the selected business outlets, bypassing most filters
  const fastBackfillMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("newsroom-scan", {
        body: {
          triggerType: "fast_publish_backfill",
          perSourceLimit: 5,
          // Keep per-run work bounded to reduce timeouts; user can run again if needed.
          maxArticlesPerRun: 10,
          userId: session?.user?.id,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Fast Publish Backfill Started",
        description: data.message || "Backfill run started. Articles will appear as they are processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["newsroom-runs"] });
      if (data.run_id) {
        setSelectedRunId(data.run_id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Backfill Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "no_news":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><AlertCircle className="w-3 h-3 mr-1" /> No News</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getArticleStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Created</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "duplicate":
        return <Badge className="bg-gray-100 text-gray-800">Duplicate</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!session || !isAdmin) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">You must be an admin or editor to access this page.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Newspaper className="h-6 w-6" />
              Automated Newsroom
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Scan Ghana business news sources and auto-generate articles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => fastBackfillMutation.mutate()}
              disabled={fastBackfillMutation.isPending}
              variant="outline"
            >
              {fastBackfillMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Backfilling...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Fast Publish Backfill
                </>
              )}
            </Button>

            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="bg-ft-maroon hover:bg-ft-maroon/90"
            >
              {scanMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Manual Scan
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Runs List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Scans</CardTitle>
                <CardDescription>Click a run to view articles</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {runsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : runs && runs.length > 0 ? (
                  <div className="divide-y">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                          selectedRunId === run.id ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          {getStatusBadge(run.status)}
                          <span className="text-xs text-muted-foreground">
                            {run.trigger_type === "scheduled" ? (
                              <Clock className="w-3 h-3 inline mr-1" />
                            ) : (
                              <Play className="w-3 h-3 inline mr-1" />
                            )}
                            {run.trigger_type}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(run.started_at), "MMM d, yyyy h:mm a")}
                        </div>
                        <div className="text-sm mt-1">
                          <span className="font-medium">{run.articles_found}</span> found · 
                          <span className="font-medium text-green-600 ml-1">{run.articles_created}</span> created
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No scans yet. Run your first scan!
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Run Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {selectedRunId ? "Scan Results" : "Select a Scan"}
                </CardTitle>
                {selectedRunId && runArticles && (
                  <CardDescription>
                    {runArticles.length} articles processed
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedRunId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a scan from the list to view details</p>
                  </div>
                ) : runArticles && runArticles.length > 0 ? (
                  <div className="space-y-4">
                    {runArticles.map((article) => {
                      const generatedArticle = article.generated_article_id 
                        ? generatedArticles?.[article.generated_article_id] 
                        : null;
                      
                      return (
                        <div
                          key={article.id}
                          className="border rounded-lg overflow-hidden hover:bg-muted/30 transition-colors"
                        >
                          {/* Image Preview */}
                          {generatedArticle?.hero_image_url && (
                            <div className="relative bg-muted">
                              <AspectRatio ratio={16 / 9}>
                                <img
                                  src={generatedArticle.hero_image_url}
                                  alt={`Editorial illustration for ${generatedArticle.title}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </AspectRatio>
                              {article.image_style && (
                                <Badge 
                                  variant="secondary" 
                                  className="absolute bottom-2 left-2 text-xs bg-black/60 text-white border-0"
                                >
                                  {article.image_style}
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {/* No image placeholder */}
                          {article.processing_status === 'completed' && !generatedArticle?.hero_image_url && (
                            <div className="bg-muted/50 p-4 flex items-center justify-center">
                              <div className="text-center text-muted-foreground">
                                <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                                <span className="text-xs">No image generated</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Article Info */}
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getArticleStatusBadge(article.processing_status)}
                                  <span className="text-xs text-muted-foreground">
                                    {article.source_name}
                                  </span>
                                </div>
                                <h4 className="font-medium text-sm line-clamp-2">
                                  {generatedArticle?.title || article.original_headline}
                                </h4>
                                {generatedArticle?.section && (
                                  <span className="text-xs text-muted-foreground mt-1 inline-block">
                                    Section: {generatedArticle.section}
                                  </span>
                                )}
                              </div>
                              {article.generated_article_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/admin/articles/${article.generated_article_id}`)}
                                  className="shrink-0"
                                >
                                  <ExternalLink className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No articles in this scan</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Info Section */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">How It Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Manual Scan:</strong> Click "Run Manual Scan" to search for news now</li>
              <li>• <strong>Scheduled Scan:</strong> Runs automatically every hour</li>
              <li>• <strong>5-Hour Rule:</strong> Only articles published in the last 5 hours are processed</li>
              <li>• <strong>Draft Status:</strong> All generated articles are saved as drafts for review</li>
              <li>• <strong>Image Styles:</strong> Rotates between 4 editorial illustration styles</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
