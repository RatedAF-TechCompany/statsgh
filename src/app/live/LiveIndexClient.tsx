"use client";

import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { LiveBadge } from "@/components/live/LiveBadge";
import { formatGmt } from "@/lib/live/format";
import type { LivePage } from "@/lib/live/types";

export function LiveIndexClient({ pages }: { pages: LivePage[] }) {
  const live = pages.filter((p) => p.status === "live");
  const ended = pages.filter((p) => p.status === "ended");

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[740px] mx-auto px-4 md:px-6 py-8">
        <h1 className="font-headline text-[32px] md:text-[36px] font-bold text-[#121212] mb-6">Live coverage</h1>
        {pages.length === 0 ? (
          <p className="font-serif text-[17px] text-[#5B5B5B]">There is no live coverage at the moment.</p>
        ) : (
          <ul className="divide-y divide-[#E8E8E8] border-t border-[#D9D9D9]">
            {[...live, ...ended].map((p) => (
              <li key={p.path} className="py-5">
                <p className="mb-1"><LiveBadge ended={p.status === "ended"} /></p>
                <Link to={`/live/${p.path}`} className="font-headline text-[22px] font-bold text-[#121212] hover:text-[#E3120B]">
                  {p.headline}
                </Link>
                <p className="font-ui text-[13px] text-[#5B5B5B] mt-1">
                  {p.status === "live" ? "Started" : "Ended"} {formatGmt((p.status === "ended" && p.ended_at) || p.started_at || p.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
