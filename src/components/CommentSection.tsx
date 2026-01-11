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
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={toggleComposer}
          className="rounded-sm border-2 border-ft-maroon bg-ft-maroon px-4 py-2 text-xs font-bold tracking-wider uppercase text-white hover:bg-ft-maroon/90 transition-colors"
        >
          Leave Comment
        </button>
      </div>

      {composerOpen && (
        <div className="rounded-sm border-2 border-ft-maroon/40 bg-[#fdf6ed] p-4 text-sm shadow-md">
          <div className="mb-3 flex items-center justify-between border-b border-ft-maroon/20 pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-ft-maroon">
              {replyToId ? `Reply to ${replyToAuthor}` : "Leave a comment"}
            </p>
            {replyToId && (
              <button
                type="button"
                onClick={handleCancelReply}
                className="text-[10px] text-black/60 hover:text-black"
              >
                Cancel reply
              </button>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-sm border-2 border-ft-maroon/30 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-ft-maroon/60 transition-colors"
            placeholder="Share your view on this story"
          />
          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="text-xs font-medium text-ft-maroon/70 hover:text-ft-maroon transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePostClick}
              disabled={!body.trim()}
              className="rounded-sm bg-ft-maroon px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40 hover:bg-ft-maroon/90 transition-colors"
            >
              Post Comment
            </button>
          </div>
        </div>
      )}

      <CommentsList articleId={articleId} onReply={handleReply} />

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
