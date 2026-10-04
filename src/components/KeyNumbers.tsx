import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { explainLabel } from "@/lib/glossary";

interface KeyDatum {
  label?: string;
  value?: number | string;
  unit?: string;
  context?: string;
}

const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i;
// Logistical / calendar labels never count as a statistic.
const NON_STAT_LABEL = /\b(date|day|days|time|hour|year|month|edition|anniversary|session|deadline|phone)\b/i;

export function realStats(raw: unknown): KeyDatum[] {
  if (!Array.isArray(raw)) return [];
  return (raw as KeyDatum[]).filter((k) => {
    if (!k || !k.label) return false;
    const n = typeof k.value === "number" ? k.value : Number(String(k.value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(n)) return false;
    if (k.unit && MONTHS.test(k.unit.trim())) return false;
    if (NON_STAT_LABEL.test(k.label)) return false;
    return true;
  });
}

const fmt = (v: number | string | undefined) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : String(v);
};

export const KeyNumbers = ({ articleId, keyData, whyItMatters }: { articleId: string; keyData: unknown; whyItMatters?: string | null }) => {
  const stats = realStats(keyData).slice(0, 3);

  const { data: source } = useQuery({
    queryKey: ["article-source", articleId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_article_source", { p_article_id: articleId });
      return (Array.isArray(data) ? data[0] : data) as { source_name: string; source_url: string } | undefined;
    },
    enabled: stats.length > 0,
    staleTime: Infinity,
  });

  if (stats.length === 0) return null;

  return (
    <aside aria-label="Key numbers" className="mb-8 border-l-4 border-[#E3120B] bg-[#FAF7F2] p-5">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B]">Key numbers</h2>
        <span className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] bg-[#E3120B] text-white px-1.5 py-0.5 rounded-sm">Data</span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {stats.map((k, i) => (
          <li key={i} className="flex flex-col">
            <span className="font-mono text-2xl font-bold text-[#121212]">
              {fmt(k.value)}{k.unit ? ` ${k.unit}` : ""}
            </span>
            <span className="font-ui text-sm text-[#5B5B5B]">
              {k.label}{k.context ? ` — ${k.context}` : ""}
            </span>
            <Explain label={`${k.label} ${k.unit ?? ""}`} />
          </li>
        ))}
      </ul>
      {whyItMatters && whyItMatters.trim() && (
        <p className="mt-4 font-serif text-[15px] leading-snug text-[#121212]">
          <strong className="font-ui text-xs uppercase tracking-[0.1em] text-[#E3120B] mr-2">Why it matters</strong>
          {whyItMatters.trim()}
        </p>
      )}
      {source?.source_url && (
        <a
          href={source.source_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-4 inline-flex items-center gap-1 font-ui text-xs text-[#5B5B5B] hover:text-[#E3120B] underline"
        >
          Source: {source.source_name || new URL(source.source_url).hostname}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </aside>
  );
};

const Explain = ({ label }: { label: string }) => {
  const [open, setOpen] = useState(false);
  const term = explainLabel(label);
  if (!term) return null;
  return (
    <span className="mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-ui text-[11px] font-semibold text-[#E3120B] underline">
        {open ? "Hide explanation" : "Explain this number"}
      </button>
      {open && (
        <span className="block mt-1 font-serif text-[13px] leading-snug text-[#121212]">
          <strong>{term.term}:</strong> {term.definition}{" "}
          <a href={`/glossary#${term.slug}`} className="text-[#E3120B] underline">Glossary</a>
        </span>
      )}
    </span>
  );
};
