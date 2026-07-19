// Free deterministic keyword gate for tweet-worthiness.
// Zero AI cost. Returns a score; caller decides pass/fail against threshold.

export const TWEET_KEYWORD_THRESHOLD = 3;

const TIER1_CURRENCY = [
  "GHS", "USD", "AUD", "EUR", "GBP", "₵", "$",
  "million", "billion", "trillion", "cedi", "cedis",
];

const TIER1_POLICY = [
  "parliament", "minister", "ministry", "bog", "bank of ghana",
  "gss", "authority", "regulator", "approved", "abolished", "launched",
  "increased", "recorded", "banned", "refund", "signed", "passed",
  "gazetted", "ratified", "budget",
];

const TIER1_BUSINESS = [
  "company", "bank", "firm", "mtn", "stanbic", "absa", "investment",
  "gcb", "fidelity", "ecobank", "cal bank", "zenith", "access bank",
  "vodafone", "airteltigo", "shell", "goil", "unilever",
];

const TIER1_SECTORS = [
  "cocoa", "gold", "oil", "petroleum", "agriculture", "fintech",
  "mining", "forex", "inflation", "employment", "trade", "export",
  "import", "gdp", "revenue", "tax", "debt", "reserves",
];

const TIER2_SURPRISING = [
  "more than", "highest", "lowest", "first time", "only ", "record ",
  "record-", "surge", "plunge", "unprecedented", "compared to",
];

const NUMERIC_RE = /\b\d[\d,]{2,}\b|\b\d+(?:\.\d+)?\s*(?:%|percent|bps|tonnes?|tons?|barrels?|kg|litres?)\b|\b\d+(?:\.\d+)?\s*(?:million|billion|trillion|thousand)\b/i;
const PERCENT_RE = /\b\d+(?:\.\d+)?\s*%|\bpercent\b/i;

export interface ScoreResult {
  score: number;
  hits: string[];
}

function countHits(text: string, keywords: string[]): string[] {
  const out: string[] = [];
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) out.push(kw);
  }
  return out;
}

export function scoreArticle(title: string, summary = ""): ScoreResult {
  const text = `${title} ${summary}`.toLowerCase();
  const hits: string[] = [];

  hits.push(...countHits(text, TIER1_CURRENCY));
  hits.push(...countHits(text, TIER1_POLICY));
  hits.push(...countHits(text, TIER1_BUSINESS));
  hits.push(...countHits(text, TIER1_SECTORS));

  // Numeric matches are worth one hit each up to two.
  const numericMatches = text.match(NUMERIC_RE);
  if (numericMatches) hits.push(`num:${numericMatches[0]}`);
  const pctMatches = text.match(PERCENT_RE);
  if (pctMatches) hits.push(`pct:${pctMatches[0]}`);

  // Tier-2 bonus: at most 1 point (avoid double-counting several phrasings).
  const tier2 = countHits(text, TIER2_SURPRISING);
  if (tier2.length) hits.push(`bonus:${tier2[0]}`);

  return { score: hits.length, hits };
}

export function passesKeywordGate(title: string, summary = ""): ScoreResult & { pass: boolean } {
  const r = scoreArticle(title, summary);
  return { ...r, pass: r.score >= TWEET_KEYWORD_THRESHOLD };
}
