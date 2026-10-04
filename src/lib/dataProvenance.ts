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
export const GSE_SOURCE = "Ghana Stock Exchange, end-of-day";

/** Short human label for a stored source key. */
export const sourceLabel = (source: string | null | undefined) => {
  if (!source) return "Unknown source";
  if (source === "open.er-api.com") return "ExchangeRate-API";
  if (source.startsWith("FRED (EIA)")) return "EIA via FRED";
  if (source.startsWith("FRED (IMF)")) return "IMF via FRED";
  return source;
};

/** "3 Oct 2026" style date for "as of" labels. */
export const asOfLabel = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
