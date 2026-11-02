import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  articleId: string;
  commentBody: string;
  parentId?: string | null;
  replyToAuthor?: string | null;
  onDone: () => void;
  onCancel: () => void;
};

type Step = "details" | "sent";

// Comments are moderated: the submit-comment function stores them unpublished and emails the editors.
// Nothing appears on the page until an editor approves it.
export function CommentAuthModal({ articleId, commentBody, parentId, replyToAuthor, onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    const e = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (commentBody.trim().length < 2 || commentBody.length > 1000) {
      setError("Comments must be between 2 and 1,000 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("submit-comment", {
        body: { articleId, name: name.trim().slice(0, 40) || "Reader", email: e, body: commentBody, parentId: parentId || null, website },
      });
      if (error) {
        let msg = "Could not send your comment. Please try again later.";
        try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      setStep("sent");
    } catch (err: any) {
      setError(err.message || "Could not send your comment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="comment-modal-title">
      <div className="w-full max-w-sm rounded-sm bg-[#f7f1e1] p-4 shadow-lg text-sm">
        {step === "details" && (
          <>
            <div id="comment-modal-title" className="mb-2 text-[11px] font-semibold uppercase tracking-wide">
              {parentId ? `Reply to ${replyToAuthor}` : "Post your comment"}
            </div>
            <p className="mb-3 text-xs text-black/80">
              Comments are reviewed by an editor before they appear. Your email is never shown publicly.
            </p>
            <div className="space-y-2">
              <label className="sr-only" htmlFor="comment-email">Email</label>
              <input id="comment-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email"
                className="w-full rounded-sm border border-black/25 bg-white px-2 py-1 text-sm" />
              <label className="sr-only" htmlFor="comment-name">Name (optional)</label>
              <input id="comment-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" autoComplete="name"
                className="w-full rounded-sm border border-black/25 bg-white px-2 py-1 text-sm" />
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)}
                className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website" />
            </div>
            {error && <div className="mt-2 text-xs text-red-700" role="alert">{error}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onCancel} className="text-xs text-black/70">Cancel</button>
              <button type="button" onClick={submit} disabled={loading}
                className="rounded-sm bg-ft-maroon px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">
                {loading ? "Sending..." : "Submit for review"}
              </button>
            </div>
          </>
        )}
        {step === "sent" && (
          <>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide">Thank you</div>
            <p className="mb-3 text-xs text-black/80" role="status">
              Your comment has been sent to our editors. It will appear here once it has been approved.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onDone} className="rounded-sm bg-ft-maroon px-3 py-1 text-xs font-semibold text-white">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
