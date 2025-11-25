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
import { logAuditEvent } from "@/lib/audit";
import { SITE_NAVIGATION } from "@/lib/navigation";
import { z } from "zod";

const statuses = ["draft", "review", "scheduled", "published"];

// Validation schema for article data
const articleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  subtitle: z.string().trim().max(300, "Subtitle must be less than 300 characters").optional(),
  slug: z.string().trim().min(1, "Slug is required").max(200, "Slug must be less than 200 characters").regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  section: z.string().min(1, "Category is required"),
  summary: z.string().trim().min(1, "Summary is required").max(500, "Summary must be less than 500 characters"),
  body: z.string().trim().min(1, "Article body is required").max(50000, "Article body must be less than 50,000 characters"),
  author_name: z.string().trim().min(1, "Author name is required").max(100, "Author name must be less than 100 characters"),
  hero_image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  seo_description: z.string().trim().max(160, "SEO description must be less than 160 characters").optional(),
});

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
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
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

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("name");
      return data;
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    }
  }, [session, isLoadingAuth, navigate]);

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
      setVideoUrl(article.video_url || "");
      setAudioUrl(article.audio_url || "");
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
      // Validate input data
      try {
        const validatedData = articleSchema.parse({
          title,
          subtitle: subtitle || "",
          slug,
          section,
          summary,
          body,
          author_name: authorName,
          hero_image_url: heroImageUrl || "",
          seo_description: seoDescription || "",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          throw new Error(firstError.message);
        }
        throw error;
      }

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
        video_url: videoUrl || null,
        audio_url: audioUrl || null,
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

        await logAuditEvent({
          actionType: status === "published" ? "ARTICLE_PUBLISHED" : "ARTICLE_UPDATED",
          targetType: "article",
          targetId: id!,
          description: `${status === "published" ? "Published" : "Updated"} article: ${title}`,
          metadata: {
            status: articleData.status,
            is_published: articleData.is_published,
          },
        });
      } else {
        const { data, error } = await supabase
          .from("articles")
          .insert([articleData])
          .select()
          .single();
        if (error) throw error;

        await logAuditEvent({
          actionType: "ARTICLE_CREATED",
          targetType: "article",
          targetId: data.id,
          description: `Created article: ${title}`,
          metadata: {
            status: articleData.status,
          },
        });
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

  if (!session || isLoadingAuth) {
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
                <Label htmlFor="video-url">Video URL (YouTube, Vimeo, etc.)</Label>
                <Input
                  id="video-url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-muted-foreground">
                  Enhances social media preview with video playback
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio-url">Audio URL (MP3, podcast, etc.)</Label>
                <Input
                  id="audio-url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://example.com/audio.mp3"
                />
                <p className="text-xs text-muted-foreground">
                  Adds audio player to social media previews
                </p>
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
                <Label htmlFor="section">Category *</Label>
                <Select value={section} onValueChange={setSection} required>
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
