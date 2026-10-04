"use client";
import { useState } from "react";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { GLOSSARY } from "@/lib/glossary";

const Glossary = () => {
  const [q, setQ] = useState("");
  const terms = [...GLOSSARY]
    .sort((a, b) => a.term.localeCompare(b.term))
    .filter((t) => !q || `${t.term} ${t.definition}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-[860px] mx-auto px-4 md:px-6 py-8">
        <div className="border-b border-[#E3120B] pb-3 mb-4">
          <h1 className="section-label text-base">Glossary</h1>
        </div>
        <p className="font-serif text-[19px] leading-[1.6] text-[#5B5B5B] mb-4">
          Plain-English definitions of the economic terms used most often in StatsGH stories.
        </p>
        <input
          className="w-full border border-[#D9D9D9] px-3 py-2 mb-6 text-[15px]"
          placeholder="Search terms…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search glossary"
        />
        <dl>
          {terms.map((t) => (
            <div key={t.slug} id={t.slug} className="border-t border-[#D9D9D9] py-4 scroll-mt-32">
              <dt className="font-serif text-lg font-bold text-[#121212]">{t.term}</dt>
              <dd className="font-serif text-[16px] leading-relaxed text-[#333] mt-1">{t.definition}</dd>
            </div>
          ))}
          {terms.length === 0 && <p className="text-sm text-[#5B5B5B]">No matching terms.</p>}
        </dl>
      </main>
      <Footer />
    </div>
  );
};

export default Glossary;
