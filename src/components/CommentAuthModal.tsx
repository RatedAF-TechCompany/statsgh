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

type Step = "details" | "code";

export function CommentAuthModal({
  articleId,
  commentBody,
  parentId,
  replyToAuthor,
  onDone,
  onCancel,
}: Props) {
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [commentId, setCommentId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startVerification() {
    setError(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-comment", {
        body: {
          articleId,
          name: name.trim() || "Reader",
          email: email.trim(),
          body: commentBody,
          parentId: parentId || null,
        },
      });

      if (error) throw error;
      
      setStep("code");
    } catch (e: any) {
      setError(e.message || "Could not start verification.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setError(null);
    if (!code.trim()) {
      setError("Enter the code we sent.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-comment", {
        body: { code: code.trim() },
      });

      if (error) throw error;

      onDone();
    } catch (e: any) {
      setError(e.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-sm bg-[#f7f1e1] p-4 shadow-lg text-sm">
        {step === "details" && (
          <>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide">
              {parentId ? `Reply to ${replyToAuthor}` : "Comment verification"}
            </div>
            <p className="mb-3 text-xs text-black/80">
              Enter your email and optional name. We will send a verification link to confirm your {parentId ? "reply" : "comment"}.
            </p>
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-sm border border-black/25 bg-white px-2 py-1 text-sm"
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full rounded-sm border border-black/25 bg-white px-2 py-1 text-sm"
              />
            </div>
            {error && (
              <div className="mt-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-black/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startVerification}
                disabled={loading}
                className="rounded-sm bg-ft-maroon px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                {loading ? "Sending..." : "Send verification"}
              </button>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide">
              Check your email
            </div>
            <p className="mb-3 text-xs text-black/80">
              We sent a verification link to {email}. Please check your email and click the link to publish your comment.
            </p>
            {error && (
              <div className="mt-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-sm bg-ft-maroon px-3 py-1 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
