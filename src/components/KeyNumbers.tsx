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

/** House-style number + unit: 10.01%, GHS 1.35 billion, US$1.5 billion, 301 deaths per 100,000. */
export function formatStat(v: number | string | undefined, unitRaw?: string) {
  const num = fmt(v);
  let u = (unitRaw ?? "").trim().replace(/GH[¢₵]|GHC\b|cedis?\b/gi, "GHS");
  if (!u) return num;
  const scale = (x: string) => x.replace(/\bbn\b/i, "billion").replace(/\bm\b|\bmn\b/i, "million").trim();
  if (/^%$|^per ?cent$|^percent$/i.test(u)) return `${num}%`;
  if (/^(percentage points?|pp|ppt)$/i.test(u)) return `${num} percentage points`;
  // "billion USD" / "million €" style: scale first, currency last.
  const r = u.match(/^(billion|bn|million|mn|m|thousand)\s+(GHS|US\$|USD|\$|€|EUR)$/i);
  if (r) u = `${r[2]} ${r[1]}`;
  if (/^(€|EUR)\s*/i.test(u)) return `€${num} ${scale(u.replace(/^(€|EUR)\s*/i, ""))}`.trim();
  const m = u.match(/^(GHS|US\$|USD|\$)\s*(.*)$/i);
  if (m) {
    const cur = /GHS/i.test(m[1]) ? "GHS " : "US$";
    const rest = scale(m[2]);
    return `${cur}${num}${rest ? " " + rest : ""}`;
  }
  return `${num} ${scale(u)}`;
}

export const KeyNumbers = ({ articleId: _articleId, keyData, whyItMatters }: { articleId: string; keyData: unknown; whyItMatters?: string | null }) => {
  const stats = realStats(keyData).slice(0, 3);

  if (stats.length === 0) return null;

  return (
    <aside aria-label="Key numbers" className="mb-8 border-l-4 border-[#E3120B] bg-[#FAF7F2] p-5">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-ui text-xs font-bold uppercase tracking-[0.14em] text-[#5B5B5B]">Key numbers</h2>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {stats.map((k, i) => (
          <li key={i} className="flex flex-col">
            <span className="font-mono text-2xl font-bold text-[#121212]">
              {formatStat(k.value, k.unit)}
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
