import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Bookmark, Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState } from "react";
import DOMPurify from "dompurify";
import { CommentsList } from "@/components/CommentsList";
import { CommentForm } from "@/components/CommentForm";

const ArticleDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToAuthor, setReplyToAuthor] = useState<string | null>(null);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      
      if (error) throw error;
      
      // Track view only if article exists
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

  // Update document head with meta tags - MUST be before early returns
  React.useEffect(() => {
    if (article) {
      // Set page title
      document.title = `${article.title} | StatsGH`;
      
      // Determine absolute image URL - ensure it's a full URL
      let imageUrl = article.hero_image_url || 'https://statsgh.com/social/statsgh-og-1200x630.png';
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://statsgh.com${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }
      
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
      metaDesc.content = article.summary || article.subtitle || 'Latest Ghana news from StatsGH';
      
      // Add/update OG tags - these will override homepage tags
      const ogTags = [
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: `https://statsgh.com/article/${article.slug}` },
        { property: 'og:title', content: article.title },
        { property: 'og:description', content: article.summary || article.subtitle || 'Latest Ghana news from StatsGH' },
        { property: 'og:image', content: imageUrl },
        { property: 'og:site_name', content: 'StatsGH' },
        { property: 'article:published_time', content: article.published_at },
        { property: 'article:modified_time', content: article.updated_at },
        { property: 'article:author', content: article.author_name },
      ];
      
      // Add video OG tags if video_url exists
      if (article.video_url) {
        let videoUrl = article.video_url;
        // Ensure full URL
        if (videoUrl && !videoUrl.startsWith('http')) {
          videoUrl = `https://statsgh.com${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
        }
        
        ogTags.push(
          { property: 'og:video', content: videoUrl },
          { property: 'og:video:secure_url', content: videoUrl },
          { property: 'og:video:type', content: 'text/html' }
        );
      }
      
      // Add audio OG tags if audio_url exists
      if (article.audio_url) {
        let audioUrl = article.audio_url;
        // Ensure full URL
        if (audioUrl && !audioUrl.startsWith('http')) {
          audioUrl = `https://statsgh.com${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
        }
        
        ogTags.push(
          { property: 'og:audio', content: audioUrl },
          { property: 'og:audio:secure_url', content: audioUrl },
          { property: 'og:audio:type', content: 'audio/mpeg' }
        );
      }
      
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
      
      // Add/update Twitter card tags - these will override homepage tags
      const twitterTags = [
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@StatsGH' },
        { name: 'twitter:title', content: article.title },
        { name: 'twitter:description', content: article.summary || article.subtitle || 'Ghana news explained with data' },
        { name: 'twitter:image', content: imageUrl },
      ];
      
      // Add video player card if video exists
      if (article.video_url) {
        twitterTags[0] = { name: 'twitter:card', content: 'player' };
        let videoUrl = article.video_url;
        if (videoUrl && !videoUrl.startsWith('http')) {
          videoUrl = `https://statsgh.com${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;
        }
        twitterTags.push(
          { name: 'twitter:player', content: videoUrl },
          { name: 'twitter:player:width', content: '1280' },
          { name: 'twitter:player:height', content: '720' }
        );
      }
      
      twitterTags.forEach(({ name, content }) => {
        if (!content) return;
        let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
        if (!tag) {
          tag = document.createElement('meta');
          tag.name = name;
          document.head.appendChild(tag);
        }
        tag.content = content;
      });
    }
    
    // Cleanup function to restore homepage meta tags when leaving article
    return () => {
      document.title = 'StatsGH – Ghana\'s Premier News Source';
    };
  }, [article]);

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

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-5 py-12 text-center">
          <h2 className="text-2xl font-serif font-bold text-ft-maroon mb-4">Article not found</h2>
          <p className="text-ft-maroon mb-6">
            The article you're looking for doesn't exist or has been removed.
          </p>
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

  // Prepare absolute image URL for structured data
  let absoluteImageUrl = article.hero_image_url || 'https://statsgh.com/social/statsgh-og-1200x630.png';
  if (absoluteImageUrl && !absoluteImageUrl.startsWith('http')) {
    absoluteImageUrl = `https://statsgh.com${absoluteImageUrl.startsWith('/') ? '' : '/'}${absoluteImageUrl}`;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://statsgh.com/article/${article.slug}`
    },
    "headline": article.title,
    "description": article.summary || article.subtitle || 'Latest Ghana news from StatsGH',
    "image": [absoluteImageUrl],
    "datePublished": article.published_at,
    "dateModified": article.updated_at || article.published_at,
    "author": {
      "@type": "Organization",
      "name": "StatsGH"
    },
    "publisher": {
      "@type": "Organization",
      "name": "StatsGH",
      "url": "https://statsgh.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://statsgh.com/social/statsgh-og-1200x630.png"
      }
    },
    "isAccessibleForFree": "true"
  };

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
          className="mb-4 transition-all duration-200 hover:translate-x-[-4px]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="text-sm font-bold text-ft-maroon uppercase mb-2">
          {article.section}
        </div>

        <h1 className="font-serif text-3xl font-bold text-ft-maroon mb-4 leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-ft-maroon mb-6">
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
            className="transition-all duration-200 hover:scale-105"
          >
            <Bookmark
              className="h-4 w-4 mr-2"
              fill={isBookmarked ? "currentColor" : "none"}
            />
            {isBookmarked ? "Saved" : "Save"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShare}
            className="transition-all duration-200 hover:scale-105"
          >
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
          className="prose prose-lg max-w-none [&_p]:mb-4 [&_p]:leading-relaxed text-foreground [&_a]:text-ft-maroon [&_a]:underline [&_a]:transition-opacity [&_a]:duration-200 hover:[&_a]:opacity-70"
          style={{
            fontSize: "16px",
            lineHeight: "1.6",
            color: "hsl(var(--foreground))",
          }}
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(article.body, {
              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre'],
              ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
            })
          }}
        />

        {/* Comments Section */}
        <div className="mt-12 pt-8 border-t border-border">
          <CommentsList 
            articleId={article.id}
            onReply={(commentId, author) => {
              setReplyToId(commentId);
              setReplyToAuthor(author);
            }}
          />
          
          <div className="mt-8">
            <CommentForm 
              articleId={article.id}
              replyToId={replyToId}
              replyToAuthor={replyToAuthor}
              onCancelReply={() => {
                setReplyToId(null);
                setReplyToAuthor(null);
              }}
              onCommentSubmitted={() => {
                queryClient.invalidateQueries({ queryKey: ["comments", article.id] });
                setReplyToId(null);
                setReplyToAuthor(null);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ArticleDetail;
