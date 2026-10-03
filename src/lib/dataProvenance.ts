// Shared rules for labelling market/indicator numbers honestly.
// Sources written by refresh jobs that are fixed estimates, not live quotes.
export const ESTIMATE_SOURCES = new Set(["market_estimate", "world_bank_estimate"]);

export const isEstimateSource = (source: string | null | undefined) =>
  !!source && ESTIMATE_SOURCES.has(source);

/** True when a timestamp is missing or older than `days`. */
export const isStale = (iso: string | null | undefined, days: number) => {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > days * 86_400_000;
};

// GSE prices older than this are not presented as current.
export const GSE_STALE_DAYS = 7;
