"use client";
import { useState } from "react";
import { Link } from "react-router-dom";
import dynamic from "next/dynamic";
import type { Series } from "./TimeChart";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { fmtDay } from "@/lib/bogRates";
import { X_HANDLE } from "@/lib/social";

export const PageShell = ({ kicker, title, intro, children, wide }: { kicker?: React.ReactNode; title: string; intro?: React.ReactNode; children: React.ReactNode; wide?: boolean }) => (
  <div className="min-h-screen bg-white">
    <Header />
    <main className={`${wide ? "max-w-[1080px]" : "max-w-[860px]"} mx-auto px-4 md:px-6 py-8`}>
      <div className="border-b border-[#E3120B] pb-3 mb-2">
        {kicker && <p className="text-xs uppercase tracking-wide text-[#5B5B5B]">{kicker}</p>}
        <h1 className="section-label text-base">{title}</h1>
      </div>
      {intro && <div className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] py-4">{intro}</div>}
      {children}
    </main>
    <Footer />
  </div>
);

export type KeyNum = { label: string; value: string; note?: string };
export const KeyNumbersBox = ({ items, source, sourceHref, asOf }: { items: KeyNum[]; source: string; sourceHref: string; asOf?: string }) => {
  if (!items.length) return <p className="font-serif text-[17px] text-[#5B5B5B] border-t border-[#D9D9D9] py-4">Data unavailable — no official figures stored yet.</p>;
  return (
    <aside className="border-t-4 border-[#E3120B] bg-[#F6F6F6] p-4 my-4" aria-label="Key numbers">
      <h2 className="kicker mb-3">Key numbers</h2>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((k) => (
          <div key={k.label}>
            <dt className="font-ui text-[11px] uppercase tracking-wide text-[#5B5B5B]">{k.label}</dt>
            <dd className="font-serif text-2xl font-bold text-[#121212]">{k.value}</dd>
            {k.note && <dd className="font-ui text-[11px] text-[#5B5B5B]">{k.note}</dd>}
          </div>
        ))}
      </dl>
      <p className="font-ui text-[11px] text-[#5B5B5B] mt-3">
        Source: <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="underline">{source}</a>{asOf ? ` · as of ${fmtDay(asOf)}` : ""}
      </p>
    </aside>
  );
};

export const ShareRow = ({ text, path }: { text: string; path: string }) => {
  const [copied, setCopied] = useState(false);
  const url = `https://www.statsgh.com${path}`;
  const enc = encodeURIComponent;
  return (
    <div className="flex flex-wrap gap-3 font-ui text-[12px] py-3">
      <a className="underline text-[#E3120B]" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}&via=${enc(X_HANDLE.replace("@", ""))}`}>Share on X</a>
      <a className="underline text-[#E3120B]" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(`${text} ${url}`)}`}>Share on WhatsApp</a>
      <button className="underline text-[#E3120B]" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
};

export type { Series };
// Lazy so recharts is only fetched on pages that actually draw a chart. Fixed height placeholder avoids layout shift.
export const TimeChart = dynamic(() => import("./TimeChart"), { ssr: false, loading: () => <div className="h-60 w-full" aria-hidden /> });

export const Methodology = ({ children }: { children: React.ReactNode }) => (
  <section className="border-t border-[#D9D9D9] py-6">
    <h2 className="kicker mb-2">How this page works</h2>
    <div className="font-serif text-[15px] leading-[1.6] text-[#5B5B5B] space-y-2">{children}</div>
    <p className="font-ui text-[12px] mt-2"><Link to="/about" className="underline text-[#E3120B]">About our methodology</Link></p>
  </section>
);
