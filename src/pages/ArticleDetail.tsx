import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Bookmark, Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const ArticleDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();
      if (error) throw error;
      
      // Track view
      if (data) {
        await supabase.from("article_views").insert({
          article_id: data.id,
          user_agent: navigator.userAgent,
          referrer: document.referrer,
          device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
        });
      }
      
      return data;
    },
  });

  const { data: isBookmarked } = useQuery({
    queryKey: ["bookmark", article?.id, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id || !article?.id) return false;
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("article_id", article.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id && !!article?.id,
  });

  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) {
        navigate("/auth");
        return;
      }

      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", session.user.id)
          .eq("article_id", article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: session.user.id, article_id: article.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", article?.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(isBookmarked ? "Removed from saved" : "Saved article");
    },
  });

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-5 py-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-5 py-12 text-center">
          <p className="text-muted-text mb-4">Article not found</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go Home
          </Button>
        </main>
      </div>
    );
  }

  const publishedDate = new Date(article.published_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://statsgh.com/article/${article.slug}`
    },
    "headline": article.title,
    "description": article.summary,
    "image": article.hero_image_url ? [article.hero_image_url] : [],
    "datePublished": article.published_at,
    "dateModified": article.updated_at,
    "author": {
      "@type": "Person",
      "name": article.author_name
    },
    "publisher": {
      "@type": "Organization",
      "name": "StatsGH",
      "url": "https://statsgh.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://statsgh.com/icons/header-logo-desktop.png"
      }
    },
    "isAccessibleForFree": "true"
  };

  // Update document head with meta tags
  React.useEffect(() => {
    if (article) {
      // Set page title
      document.title = `${article.title} - StatsGH`;
      
      // Add/update canonical link
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `https://statsgh.com/article/${article.slug}`;
      
      // Add/update meta description
      let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = article.summary;
      
      // Add/update OG tags
      const ogTags = [
        { property: 'og:title', content: article.title },
        { property: 'og:description', content: article.summary },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: `https://statsgh.com/article/${article.slug}` },
        { property: 'og:image', content: article.hero_image_url || '' },
        { property: 'article:published_time', content: article.published_at },
        { property: 'article:modified_time', content: article.updated_at },
        { property: 'article:author', content: article.author_name },
      ];
      
      ogTags.forEach(({ property, content }) => {
        if (!content) return;
        let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.content = content;
      });
    }
  }, [article]);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Header />

      <main className="max-w-3xl mx-auto px-5 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="text-sm font-bold text-accent uppercase mb-2">
          {article.section}
        </div>

        <h1 className="font-serif text-3xl font-bold mb-4 leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-muted-text mb-6">
          <span>By {article.author_name}</span>
          <span>•</span>
          <span>{publishedDate}</span>
          <span>•</span>
          <span>5 min read</span>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleBookmark.mutate()}
          >
            <Bookmark
              className="h-4 w-4 mr-2"
              fill={isBookmarked ? "currentColor" : "none"}
            />
            {isBookmarked ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>

        {article.hero_image_url && (
          <img
            src={article.hero_image_url}
            alt={article.title}
            className="w-full mb-6"
          />
        )}

        <div
          className="prose prose-lg max-w-none"
          style={{
            fontSize: "16px",
            lineHeight: "1.6",
            color: "hsl(var(--foreground))",
          }}
          dangerouslySetInnerHTML={{ __html: article.body }}
        />
      </main>
    </div>
  );
};

export default ArticleDetail;
