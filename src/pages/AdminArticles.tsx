import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, PlusCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { logAuditEvent } from "@/lib/audit";
import { useEffect, useState, useMemo } from "react";
import { SITE_NAVIGATION, CATEGORY_MAPPING } from "@/lib/navigation";

const AdminArticles = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"category" | "status" | null>(null);
  const [bulkValue, setBulkValue] = useState<string>("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    }
  }, [session, isLoadingAuth, navigate]);

  const { data: allArticles, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter articles based on search and filters
  const articles = useMemo(() => {
    if (!allArticles) return [];
    
    return allArticles.filter(article => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Category filter
      const matchesCategory = filterCategory === "all" || 
        article.section === filterCategory;
      
      // Status filter
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "published" && article.is_published) ||
        (filterStatus === "draft" && !article.is_published);
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [allArticles, searchQuery, filterCategory, filterStatus]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedArticles([]);
  }, [searchQuery, filterCategory, filterStatus]);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("all");
    setFilterStatus("all");
  };

  const hasActiveFilters = searchQuery !== "" || filterCategory !== "all" || filterStatus !== "all";

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data;
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (article: { id: string; title: string }) => {
      const { error } = await supabase.from("articles").delete().eq("id", article.id);
      if (error) throw error;

      await logAuditEvent({
        actionType: "ARTICLE_DELETED",
        targetType: "article",
        targetId: article.id,
        description: `Deleted article: ${article.title}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-articles"] });
      toast.success("Article deleted");
    },
    onError: () => {
      toast.error("Failed to delete article");
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      const updates: any = {};
      
      // If updating category, update both section and category_slug
      if (field === "section") {
        updates.section = value;
        updates.category_slug = value;
      } else {
        updates[field] = value;
      }
      
      for (const articleId of selectedArticles) {
        const { error } = await supabase
          .from("articles")
          .update(updates)
          .eq("id", articleId);
        
        if (error) throw error;
      }

      await logAuditEvent({
        actionType: "ARTICLE_BULK_UPDATE",
        targetType: "article",
        description: `Updated ${selectedArticles.length} articles: ${field} = ${value}`,
        metadata: { articleIds: selectedArticles, field, value },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-articles"] });
      toast.success(`Updated ${selectedArticles.length} articles`);
      setSelectedArticles([]);
      setShowBulkDialog(false);
      setBulkAction(null);
      setBulkValue("");
    },
    onError: () => {
      toast.error("Failed to update articles");
    },
  });

  const toggleSelectAll = () => {
    if (selectedArticles.length === articles?.length && articles?.length > 0) {
      setSelectedArticles([]);
    } else {
      setSelectedArticles(articles?.map(a => a.id) || []);
    }
  };

  const toggleSelectArticle = (id: string) => {
    setSelectedArticles(prev =>
      prev.includes(id) ? prev.filter(aid => aid !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (action: "category" | "status") => {
    setBulkAction(action);
    setBulkValue("");
    setShowBulkDialog(true);
  };

  const executeBulkAction = () => {
    if (!bulkAction || !bulkValue) return;
    // Map UI "category" to database "section" field
    const field = bulkAction === "category" ? "section" : bulkAction;
    bulkUpdate.mutate({ field, value: bulkValue });
  };

  if (!session || isLoadingAuth) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-serif text-3xl font-bold">Manage Articles</h1>
          <Button onClick={() => navigate("/admin/articles/new")}>
            <PlusCircle className="h-4 w-4 mr-2" />
            New Article
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles by title or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {SITE_NAVIGATION.categories
                  .filter(item => item.type === 'category')
                  .map((item) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Indicator */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {articles?.length || 0} of {allArticles?.length || 0} articles
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {selectedArticles.length > 0 && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {selectedArticles.length} article{selectedArticles.length > 1 ? "s" : ""} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedArticles([])}
              >
                Clear Selection
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleBulkAction("category")}>
                Update Category
              </Button>
              <Button size="sm" onClick={() => handleBulkAction("status")}>
                Update Status
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div>Loading...</div>
        ) : !articles || articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-text mb-4">No articles yet</p>
            <Button onClick={() => navigate("/admin/articles/new")}>
              Create First Article
            </Button>
          </div>
        ) : (
          <>
            {articles && articles.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  checked={selectedArticles.length === articles.length}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  Select all articles
                </Label>
              </div>
            )}
            <div className="space-y-4">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="p-4 border border-divider bg-surface flex justify-between items-start gap-4"
                >
                  <div className="flex gap-3 flex-1">
                    <Checkbox
                      checked={selectedArticles.includes(article.id)}
                      onCheckedChange={() => toggleSelectArticle(article.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={article.is_published ? "default" : "outline"}>
                          {article.is_published ? "Published" : "Draft"}
                        </Badge>
                        <span className="text-xs text-muted-text">
                          {CATEGORY_MAPPING[article.section as keyof typeof CATEGORY_MAPPING] || article.section}
                        </span>
                      </div>
                      <h3 className="font-serif text-xl font-semibold mb-1">
                        {article.title}
                      </h3>
                      <p className="text-sm text-muted-text line-clamp-2">
                        {article.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/articles/${article.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (
                          confirm("Are you sure you want to delete this article?")
                        ) {
                          deleteArticle.mutate({ id: article.id, title: article.title });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Bulk Update {bulkAction === "category" ? "Category" : "Status"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Update {selectedArticles.length} selected article{selectedArticles.length > 1 ? "s" : ""}
              </p>
              
              {bulkAction === "category" && (
                <div className="space-y-2">
                  <Label>New Category</Label>
                  <Select value={bulkValue} onValueChange={setBulkValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITE_NAVIGATION.categories
                        .filter(item => item.type === 'category')
                        .map((item) => (
                          <SelectItem key={item.slug} value={item.slug}>
                            {item.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {bulkAction === "status" && (
                <div className="space-y-2">
                  <Label>New Status</Label>
                  <Select value={bulkValue} onValueChange={setBulkValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={executeBulkAction} 
                disabled={!bulkValue || bulkUpdate.isPending}
              >
                {bulkUpdate.isPending ? "Updating..." : "Update Articles"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminArticles;
