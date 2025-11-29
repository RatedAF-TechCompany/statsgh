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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Comments</h2>
        <button
          type="button"
          onClick={toggleComposer}
          className="rounded-sm border border-black/30 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide uppercase"
        >
          Comment
        </button>
      </div>

      {composerOpen && (
        <div className="rounded-sm border border-black/25 bg-[#f0e3cf] p-3 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-black/70">
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
            className="w-full resize-none rounded-sm border border-black/20 bg-white px-2 py-1 text-sm leading-snug outline-none"
            placeholder="Share your view on this story"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="text-xs text-black/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePostClick}
              disabled={!body.trim()}
              className="rounded-sm bg-ft-maroon px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Post comment
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
