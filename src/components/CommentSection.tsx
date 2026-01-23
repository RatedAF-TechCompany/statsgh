import { useState } from "react";
import { CommentsList } from "./CommentsList";
import { CommentAuthModal } from "./CommentAuthModal";

type Props = {
  articleId: string;
};

export function CommentSection({ articleId }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [body, setBody] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToAuthor, setReplyToAuthor] = useState<string | null>(null);

  function toggleComposer() {
    setComposerOpen((v) => !v);
  }

  function handlePostClick() {
    if (!body.trim()) return;
    setAuthOpen(true);
  }

  function handleCommentPosted() {
    setAuthOpen(false);
    setBody("");
    setComposerOpen(false);
    setReplyToId(null);
    setReplyToAuthor(null);
  }

  function handleReply(commentId: string, authorName: string) {
    setReplyToId(commentId);
    setReplyToAuthor(authorName);
    setBody("");
    setComposerOpen(true);
  }

  function handleCancelReply() {
    setReplyToId(null);
    setReplyToAuthor(null);
  }

  return (
    <section className="space-y-6">
      {/* Leave Comment Button - Right under the article */}
      <button
        type="button"
        onClick={toggleComposer}
        className="px-5 py-2.5 text-xs font-bold tracking-wide uppercase bg-foreground text-background hover:bg-foreground/90 transition-colors"
      >
        Leave Comment
      </button>

      {/* Section Header */}
      <h2 className="font-serif text-xl font-semibold text-foreground border-b border-border pb-3">
        Comments
      </h2>

      {/* Comment Composer */}
      {composerOpen && (
        <div className="border border-border bg-muted/30 p-5">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {replyToId ? `Reply to ${replyToAuthor}` : "Leave a comment"}
            </p>
            {replyToId && (
              <button
                type="button"
                onClick={handleCancelReply}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel reply
              </button>
            )}
          </div>
          
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full resize-none border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
            placeholder="Share your thoughts on this article..."
          />
          
          <div className="mt-4 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePostClick}
              disabled={!body.trim()}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide bg-foreground text-background disabled:opacity-40 hover:bg-foreground/90 transition-colors"
            >
              Post Comment
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      <CommentsList articleId={articleId} onReply={handleReply} />

      {/* Auth Modal */}
      {authOpen && (
        <CommentAuthModal
          articleId={articleId}
          commentBody={body}
          parentId={replyToId}
          replyToAuthor={replyToAuthor}
          onDone={handleCommentPosted}
          onCancel={() => setAuthOpen(false)}
        />
      )}
    </section>
  );
}
