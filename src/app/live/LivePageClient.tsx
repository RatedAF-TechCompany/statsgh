"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { LiveBadge } from "@/components/live/LiveBadge";
import { LiveFeed } from "@/components/live/LiveFeed";
import { UpdatedAgo } from "@/components/live/UpdatedAgo";
import type { LivePageWithEntries } from "@/lib/live/types";

export function LivePageClient({ initial }: { initial: LivePageWithEntries }) {
  const router = useRouter();
  const [page, setPage] = useState(initial);
  const ended = page.status === "ended";
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPage(initial);
  }, [initial]);

  useEffect(() => {
    if (ended) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(page.path)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LivePageWithEntries;
        if (cancelled) return;
        setPage(data);
        router.refresh();
        if (data.status === "ended" && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      } catch {
        // Keep showing the last good snapshot.
      }
    };
    timer.current = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [ended, page.path, router]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[740px] mx-auto px-4 md:px-6 py-8">
        <p className="mb-3">
          <LiveBadge ended={ended} />
        </p>
        <h1 className="font-headline text-[32px] md:text-[40px] font-bold leading-[1.15] text-[#121212] mb-3">
          {page.headline}
        </h1>
        <p className="font-ui text-[13px] text-[#5B5B5B] mb-6">
          <UpdatedAgo iso={page.content_updated_at} />
          <span className="mx-2 text-[#ccc]">·</span>
          <span>By {page.byline}</span>
        </p>

        <section className="bg-[#F6F6F6] border border-[#E8E8E8] px-5 py-4 mb-8" aria-label="Summary">
          <h2 className="font-ui text-[12px] font-bold uppercase tracking-wide text-[#5B5B5B] mb-2">Summary</h2>
          <ul className="list-disc pl-5 space-y-1.5 font-serif text-[16px] leading-[1.5] text-[#121212]">
            {page.summary_bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <h2 className="font-ui text-[12px] font-bold uppercase tracking-wide text-[#5B5B5B] mb-2">
          Live reporting
        </h2>
        <LiveFeed entries={page.entries} />
      </main>
      <Footer />
    </div>
  );
}
