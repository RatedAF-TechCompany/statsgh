import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    slug: string;
    section: string;
    summary: string;
    hero_image_url: string | null;
  };
  isMostRead?: boolean;
}

export const ArticleCard = ({ article, isMostRead = false }: ArticleCardProps) => {
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
      className="flex gap-4 py-3 px-4 border-b border-divider hover:bg-muted/50 transition-colors"
      style={isMostRead ? {
        backgroundColor: '#F2DAC4',
        borderLeft: '4px solid #B03060'
      } : undefined}
    >
      <div className="flex-1 min-w-0">
        <div
          className="cursor-pointer"
          onClick={() => navigate(`/article/${article.slug}`)}
        >
          <div className="text-sm font-bold text-accent uppercase mb-1">
            {article.section}
          </div>
          <h2 className="font-serif text-lg font-bold leading-tight mb-1 line-clamp-3">
            {article.title}
          </h2>
          <p className="text-sm text-secondary-text leading-relaxed line-clamp-3">
            {article.summary}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {article.hero_image_url && (
          <div
            className="w-[120px] h-[80px] bg-muted flex-shrink-0 cursor-pointer overflow-hidden"
            onClick={() => navigate(`/article/${article.slug}`)}
          >
            <img
              src={article.hero_image_url}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-xs h-auto py-1 px-2"
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
