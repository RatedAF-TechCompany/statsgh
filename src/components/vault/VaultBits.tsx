"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 md:px-6 py-8">{children}</main>
      <Footer />
    </div>
  );
}

export function MiniChart({ data, label, height = 240 }: { data: { x: string; y: number }[]; label: string; height?: number }) {
  if (data.length < 2) return <p className="font-ui text-sm text-[#5B5B5B]">Not enough stored observations to chart yet.</p>;
  return (
    <figure>
      <figcaption className="font-ui text-xs text-[#5B5B5B] mb-1">{label}</figcaption>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#eee" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} minTickGap={40} tickFormatter={(v: string) => String(v).slice(0, 10)} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={55} />
            <Tooltip labelFormatter={(v) => String(v).slice(0, 10)} />
            <Line type="monotone" dataKey="y" name={label} stroke="#E3120B" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function CiteBox({ text }: { text: string }) {
  return (
    <div className="border border-[#D9D9D9] bg-[#FAF7F2] p-4">
      <h2 className="kicker mb-2">Cite this data</h2>
      <p className="font-serif text-[15px] leading-[1.6] text-[#121212]">{text}</p>
      <button
        type="button"
        className="mt-2 font-ui text-xs font-semibold text-[#E3120B] underline"
        onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("Citation copied"); } catch { toast.error("Could not copy"); } }}
      >
        Copy citation
      </button>
    </div>
  );
}

export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-3 font-ui text-xs text-[#5B5B5B]">
      <span className="font-semibold">Share:</span>
      <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/tweet?text=${encodeURIComponent(`${title} — via @StatsGH`)}&url=${encodeURIComponent(url)}`}>X</a>
      <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} — StatsGH ${url}`)}`}>WhatsApp</a>
      <a className="underline" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedIn</a>
      <button type="button" className="underline" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* ignore */ } }}>{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
}
