import { realStats, formatStat } from "@/components/KeyNumbers";

/** Collapsible "Numbers behind the story" panel. Sources are kept internally and never rendered (Zeb, 3 Nov 2026). */
export const NumbersBehindStory = ({ articleId: _articleId, keyData, publishedAt: _publishedAt }: { articleId: string; keyData: unknown; publishedAt?: string | null }) => {
  const stats = realStats(keyData);
  return (
    <details className="my-8 border border-[#D9D9D9] bg-white group">
      <summary className="cursor-pointer select-none px-4 py-3 font-ui text-sm font-bold uppercase tracking-[0.1em] text-[#121212] flex justify-between">
        Numbers behind the story <span className="text-[#E3120B] group-open:rotate-45 transition-transform">+</span>
      </summary>
      <div className="px-4 pb-4 font-serif text-[15px] leading-relaxed text-[#333] space-y-3">
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-[0.1em] text-[#5B5B5B] mb-1">Figures used</h3>
          {stats.length ? (
            <ul className="list-disc pl-5">
              {stats.map((k, i) => (
                <li key={i}>{k.label}: {formatStat(k.value, k.unit)}{k.context ? ` (${k.context})` : ""}</li>
              ))}
            </ul>
          ) : (
            <p>No structured figures were extracted for this story.</p>
          )}
        </div>
        <p className="font-ui text-sm">
          <a href="/about" className="text-[#E3120B] underline">About &amp; Methodology</a> · <a href="/glossary" className="text-[#E3120B] underline">Glossary</a> · <a href="/corrections" className="text-[#E3120B] underline">Report or view corrections</a>
        </p>
      </div>
    </details>
  );
};
