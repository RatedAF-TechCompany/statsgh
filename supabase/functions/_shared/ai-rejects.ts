// Shared ai_rejects helpers. Check before any AI classification call; write on
// every rejection so we never pay to re-classify the same item.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha1, normalizeTitle } from "./ai-gateway.ts";

export type RejectClient = ReturnType<typeof createClient>;

export async function isRejected(
  supabase: RejectClient,
  url: string | null | undefined,
  title: string,
): Promise<{ rejected: boolean; reason?: string }> {
  const urlHash = url ? await sha1(url.trim()) : "";
  const titleHash = await sha1(normalizeTitle(title));
  const orClauses: string[] = [];
  if (urlHash) orClauses.push(`url_hash.eq.${urlHash}`);
  orClauses.push(`title_hash.eq.${titleHash}`);
  const { data, error } = await supabase
    .from("ai_rejects")
    .select("reason")
    .or(orClauses.join(","))
    .limit(1)
    .maybeSingle();
  if (error || !data) return { rejected: false };
  return { rejected: true, reason: (data as any).reason };
}

export async function recordReject(
  supabase: RejectClient,
  url: string | null | undefined,
  title: string,
  reason: string,
  sourceName?: string,
): Promise<void> {
  const urlHash = url ? await sha1(url.trim()) : await sha1("no-url:" + normalizeTitle(title));
  const titleHash = await sha1(normalizeTitle(title));
  await supabase
    .from("ai_rejects")
    .upsert(
      { url_hash: urlHash, title_hash: titleHash, reason, source_name: sourceName ?? null },
      { onConflict: "url_hash" },
    );
}
