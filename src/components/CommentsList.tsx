import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CommentsListProps {
  articleId: string;
}

interface Comment {
  id: string;
  article_id: string;
  name: string | null;
  email: string;
  body: string;
  is_published: boolean;
  verification_code: string;
  verification_expires_at: string;
  created_at: string;
  parent_id: string | null;
}

export const CommentsList = ({ articleId }: CommentsListProps) => {
  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("article_id", articleId)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Comment[];
    },
  });

  // Organize comments into threads
  const topLevelComments = comments?.filter(c => !c.parent_id) || [];
  const getReplies = (parentId: string) => 
    comments?.filter(c => c.parent_id === parentId).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No comments yet. Be the first to share your thoughts!</p>
      </div>
    );
  }

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const replies = getReplies(comment.id);
    
    return (
      <div className={`${isReply ? 'ml-8 mt-4' : ''}`}>
        <div className="border-b border-border pb-4 last:border-b-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm">
              {comment.name || "Anonymous"}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {comment.body}
          </p>
        </div>
        
        {replies.length > 0 && (
          <div className="space-y-4 mt-4">
            {replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="font-serif text-xl font-bold">
        Comments ({comments?.length || 0})
      </h3>
      
      {topLevelComments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
};