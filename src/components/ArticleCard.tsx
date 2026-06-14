import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    slug: string;
    category_slug: string;
    section: string;
    summary: string;
    hero_image_url: string | null;
    is_wire?: boolean;
  };
  isMostRead?: boolean;
  backgroundColor?: string;
}

export const ArticleCard = ({ article, isMostRead = false, backgroundColor }: ArticleCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isBookmarked } = useQuery({
    queryKey: ["bookmark", article.id, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("article_id", article.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
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
      queryClient.invalidateQueries({ queryKey: ["bookmark", article.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success(isBookmarked ? "Removed from saved" : "Saved article");
    },
    onError: () => {
      toast.error("Failed to update bookmark");
    },
  });

  return (
    <article
      className="relative flex gap-4 py-3 px-4 border-b border-divider transition-colors"
      style={isMostRead ? {
        backgroundColor: '#F2DAC4',
        borderLeft: '4px solid #B03060'
      } : backgroundColor ? {
        backgroundColor
      } : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-accent uppercase">
            {article.section}
          </span>
        </div>
        <h2 className="font-serif text-lg font-bold leading-tight mb-1 line-clamp-3">
          {/* Stretched link → whole card navigates to the article */}
          <Link
            to={`/${article.category_slug}/${article.slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </h2>
        <p className="text-sm text-secondary-text leading-relaxed line-clamp-3">
          {article.summary}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        {typeof article.hero_image_url === "string" && article.hero_image_url.startsWith("http") && (
          <div className="w-[120px] h-[80px] bg-muted flex-shrink-0 overflow-hidden">
            <img
              src={article.hero_image_url}
              alt={article.title}
              width={120}
              height={80}
              loading="lazy"
              decoding="async"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="relative z-10 flex items-center gap-1 text-xs h-auto py-1 px-2"
          onClick={(e) => {
            e.stopPropagation();
            toggleBookmark.mutate();
          }}
        >
          <Bookmark
            className="h-4 w-4"
            fill={isBookmarked ? "currentColor" : "none"}
          />
          <span>Save</span>
        </Button>
      </div>
    </article>
  );
};
