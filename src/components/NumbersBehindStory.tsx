import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { realStats } from "@/components/KeyNumbers";

/** Collapsible "Numbers behind the story" methodology & source panel. */
export const NumbersBehindStory = ({ articleId, keyData, publishedAt }: { articleId: string; keyData: unknown; publishedAt?: string | null }) => {
  const stats = realStats(keyData);
  const { data: source } = useQuery({
    queryKey: ["article-source", articleId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_article_source", { p_article_id: articleId });
      return (Array.isArray(data) ? data[0] : data) as { source_name: string; source_url: string } | undefined;
    },
    staleTime: Infinity,
  });

  return (
    <details className="my-8 border border-[#D9D9D9] bg-white group">
      <summary className="cursor-pointer select-none px-4 py-3 font-ui text-sm font-bold uppercase tracking-[0.1em] text-[#121212] flex justify-between">
        Numbers behind the story <span className="text-[#E3120B] group-open:rotate-45 transition-transform">+</span>
      </summary>
      <div className="px-4 pb-4 font-serif text-[15px] leading-relaxed text-[#333] space-y-3">
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-[0.1em] text-[#5B5B5B] mb-1">Source</h3>
          {source?.source_url ? (
            <a href={source.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
              {source.source_name || new URL(source.source_url).hostname}
            </a>
          ) : (
            <p>Original source link unavailable for this story.</p>
          )}
        </div>
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-[0.1em] text-[#5B5B5B] mb-1">Figures used</h3>
          {stats.length ? (
            <ul className="list-disc pl-5">
              {stats.map((k, i) => (
                <li key={i}>{k.label}: {String(k.value)}{k.unit ? ` ${k.unit}` : ""}{k.context ? ` (${k.context})` : ""}</li>
              ))}
            </ul>
          ) : (
            <p>No structured figures were extracted for this story.</p>
          )}
        </div>
        <div>
          <h3 className="font-ui text-xs font-bold uppercase tracking-[0.1em] text-[#5B5B5B] mb-1">How we checked it</h3>
          <p>
            Before publication every StatsGH story must report a current, sourced statistic about Ghana, link to its source and not repeat an event we have already covered.
            Figures are taken from the source report as published{publishedAt ? ` and were current on ${new Date(publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
          </p>
        </div>
        <p className="font-ui text-sm">
          <a href="/about" className="text-[#E3120B] underline">About &amp; Methodology</a> · <a href="/glossary" className="text-[#E3120B] underline">Glossary</a> · <a href="/corrections" className="text-[#E3120B] underline">Report or view corrections</a>
        </p>
      </div>
    </details>
  );
};
