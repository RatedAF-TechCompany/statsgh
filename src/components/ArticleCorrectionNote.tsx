"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Shows a visible "Corrected" note at the top of any article that has a
 * corrections entry. Renders nothing when the article has no corrections.
 */
export const ArticleCorrectionNote = ({ articleId }: { articleId: string }) => {
  const { data: corrections } = useQuery({
    queryKey: ["article-corrections", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrections")
        .select("id, what_was_wrong, what_was_fixed, corrected_at")
        .eq("article_id", articleId)
        .order("corrected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!corrections || corrections.length === 0) return null;

  return (
    <div className="border-l-4 border-[#E3120B] bg-[#FFF9F5] px-4 py-3 mb-8">
      {corrections.map((c) => (
        <div key={c.id} className="mb-2 last:mb-0">
          <div className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-[#E3120B] mb-1">
            Corrected {format(new Date(c.corrected_at), "d MMMM yyyy")}
          </div>
          <p className="font-ui text-[13px] leading-relaxed text-[#3B3B3B]">
            An earlier version of this article said: {c.what_was_wrong} It now says: {c.what_was_fixed}
          </p>
        </div>
      ))}
    </div>
  );
};
