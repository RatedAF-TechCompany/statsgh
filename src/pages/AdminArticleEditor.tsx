import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { ImageUploader } from "@/components/ImageUploader";

const statuses = ["draft", "review", "scheduled", "published"];

const AdminArticleEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [section, setSection] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isMostRead, setIsMostRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

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
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data;
    },
  });

  useEffect(() => {
    if (isAdmin === false) {
      navigate("/");
    }
  }, [isAdmin, navigate]);

  const { data: article } = useQuery({
    queryKey: ["article-edit", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSubtitle(article.subtitle || "");
      setSlug(article.slug);
      setSection(article.section);
      setCategoryId(article.category_id || "");
      setSummary(article.summary);
      setBody(article.body);
      setAuthorName(article.author_name);
      setHeroImageUrl(article.hero_image_url || "");
      setTags(article.tags?.join(", ") || "");
      setSeoDescription(article.seo_description || "");
      setStatus(article.status || "draft");
      setScheduledAt(article.scheduled_at || "");
      setIsPublished(article.is_published);
      setIsMostRead(article.is_most_read || false);
    }
  }, [article]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (isEditing && body) {
      const timer = setTimeout(() => {
        saveVersion();
      }, 10000); // Auto-save every 10 seconds
      setAutoSaveTimer(timer);
    }

    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [body, title]);

  const saveVersion = async () => {
    if (!id || !session?.user?.id) return;
    
    const { data: versions } = await supabase
      .from("article_versions")
      .select("version_number")
      .eq("article_id", id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    await supabase.from("article_versions").insert({
      article_id: id,
      title,
      body,
      version_number: nextVersion,
      is_autosave: true,
      saved_by: session.user.id,
    });
  };

  useEffect(() => {
    if (!isEditing && title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setSlug(generatedSlug);
    }
  }, [title, isEditing]);

  const saveArticle = useMutation({
    mutationFn: async () => {
      const tagsArray = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      
      const articleData = {
        title,
        subtitle,
        slug,
        section,
        category_id: categoryId || null,
        summary,
        body,
        author_name: authorName,
        hero_image_url: heroImageUrl || null,
        tags: tagsArray,
        seo_description: seoDescription,
        status,
        scheduled_at: scheduledAt || null,
        is_published: status === "published",
        is_most_read: isMostRead,
        published_at: status === "published" ? new Date().toISOString() : null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("articles")
          .update(articleData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("articles").insert([articleData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-articles"] });
      toast.success(isEditing ? "Article updated" : "Article created");
      navigate("/admin/articles");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await saveArticle.mutateAsync();
    setLoading(false);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/articles")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Articles
          </Button>
          {article && (
            <Button
              variant="outline"
              onClick={() => window.open(`/article/${article.slug}`, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}
        </div>

        <h1 className="font-serif text-3xl font-bold mb-8">
          {isEditing ? "Edit Article" : "Create New Article"}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Article title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Short subtitle"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary *</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  placeholder="Brief summary of the article"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hero-image">Hero Image</Label>
                <ImageUploader
                  onUploadComplete={(url) => setHeroImageUrl(url)}
                  currentImage={heroImageUrl}
                  onRemove={() => setHeroImageUrl("")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Article Body *</Label>
                <RichTextEditor
                  content={body}
                  onChange={setBody}
                  placeholder="Write your article content here..."
                />
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="p-4 border border-border rounded-md space-y-4">
              <h3 className="font-semibold">Metadata</h3>
              
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  placeholder="article-slug"
                />
                <p className="text-xs text-muted-foreground">
                  URL: /article/{slug || "your-slug"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Author Name *</Label>
                <Input
                  id="author"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Section *</Label>
                <Input
                  id="section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  placeholder="Markets, World, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="economy, markets, tech"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo">SEO Description</Label>
                <Textarea
                  id="seo"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Meta description for SEO"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 border border-border rounded-md space-y-4">
              <h3 className="font-semibold">Publishing</h3>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {status === "scheduled" && (
                <div className="space-y-2">
                  <Label htmlFor="scheduled">Schedule Date & Time</Label>
                  <Input
                    id="scheduled"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="most-read"
                  checked={isMostRead}
                  onCheckedChange={setIsMostRead}
                />
                <Label htmlFor="most-read">Featured Article</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading} onClick={handleSubmit} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : isEditing ? "Update Article" : "Create Article"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/articles")}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminArticleEditor;
