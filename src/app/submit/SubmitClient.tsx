"use client";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function SubmitClient() {
  const [authorName, setAuthorName] = useState("");
  const [authorBio, setAuthorBio] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim() || content.trim().length < 200) {
      toast.error("Please provide your name and at least 200 characters of commentary.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("newsroom_candidates").insert({
        title: title || content.slice(0, 80),
        content: content,
        source_name: `Expert: ${authorName}`,
        source_url: null,
        author_name: authorName,
        author_bio: authorBio || null,
        status: "expert_pending",
        submitted_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      setSubmitted(true);
      toast.success("Submission received. Our editors will review shortly.");
    } catch (err: any) {
      toast.error(err?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="border-b border-[#D9D9D9] pb-6 mb-8">
          <p className="font-ui text-xs uppercase tracking-[0.14em] text-[#5B5B5B]">Expert commentary</p>
          <h1 className="font-headline text-4xl font-bold text-[#121212] mt-1">Submit an analysis</h1>
          <p className="font-ui text-[#5B5B5B] mt-3 max-w-2xl">
            StatsGH publishes commentary from economists, researchers, and institutions with expertise on the
            Ghanaian economy. Submissions are reviewed by our editors before publication.
          </p>
        </div>

        {submitted ? (
          <div className="border-l-4 border-[#E3120B] bg-[#FAF7F2] p-6">
            <h2 className="font-headline text-xl font-bold text-[#121212]">Thank you</h2>
            <p className="font-ui text-sm text-[#5B5B5B] mt-2">
              Your submission is in the editorial queue. We publish approved commentary within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B] block mb-2">
                Your name *
              </label>
              <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Dr. Jane Doe" />
            </div>
            <div>
              <label className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B] block mb-2">
                Affiliation / bio (one line)
              </label>
              <Input value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} placeholder="Senior Fellow, IMANI Africa" />
            </div>
            <div>
              <label className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B] block mb-2">
                Proposed headline
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional — we'll edit for house style" />
            </div>
            <div>
              <label className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B] block mb-2">
                Commentary * (min 200 chars)
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder="Paste your full analysis here. Include specific figures, sources, and citations."
              />
              <p className="font-ui text-xs text-[#8A8A8A] mt-1">{content.length} characters</p>
            </div>
            <Button type="submit" disabled={submitting} className="bg-[#E3120B] hover:bg-[#B3100A] text-white">
              {submitting ? "Submitting..." : "Submit for review"}
            </Button>
          </form>
        )}
      </main>
    </>
  );
}
