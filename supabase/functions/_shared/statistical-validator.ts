// StatsGH statistical tweet validator.
// Deterministic gates that run BEFORE and AFTER the AI step. The model is never
// the final gatekeeper: an article only reaches Gemini when qualifies === true,
// and a generated tweet only reaches the queue when validateFinalTweet passes.

export const MAX_TWEET_LENGTH = 200;
export const SITE_ORIGIN = "https://statsgh.com";

export type RejectCode =
  | "REJECT_NO_SUBSTANTIVE_NUMBER"
  | "REJECT_DATE_ONLY"
  | "REJECT_NOT_GHANA"
  | "REJECT_DUPLICATE_ARTICLE"
  | "REJECT_DUPLICATE_EVENT"
  | "REJECT_AI_SKIP"
  | "REJECT_AI_HALLUCINATED_NUMBER"
  | "REJECT_OVER_200_CHARS"
  | "REJECT_URL_MISSING"
  | "REJECT_URL_MISMATCH"
  | "REJECT_VALIDATION_FAILED"
  | "QUEUED"
  | "POSTED"
  | "POST_FAILED";

export interface SubstantiveNumber {
  raw: string;       // as it appears in the article
  value: number;     // normalised numeric value
  unit: string;      // %, GHS, USD, tonnes, MW, jobs, ...
  scale: number;     // 1 | 1e3 | 1e6 | 1e9 | 1e12
  kind: "currency" | "percent" | "quantity" | "count";
  weight: number;    // ranking contribution
  context: string;   // surrounding words
}

export interface ArticleLike {
  id: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  slug?: string | null;
  category_slug?: string | null;
}

export interface ValidationResult {
  qualifies: boolean;
  substantiveNumbers: SubstantiveNumber[];
  reason: string;
  code?: RejectCode;
  ghanaRelevant: boolean;
  score: number;
}

/* ------------------------------------------------------------------ */
/* Ghana relevance                                                     */
/* ------------------------------------------------------------------ */

const GHANA_MARKERS = [
  "ghana", "ghanaian", "accra", "kumasi", "tamale", "takoradi", "tema",
  "sekondi", "cape coast", "ho ", "sunyani", "koforidua", "wa ", "bolgatanga",
  "techiman", "obuasi", "ashanti", "greater accra", "volta region",
  "bank of ghana", "bog ", "gse", "ghana stock exchange", "gra",
  "ghana revenue authority", "ghana statistical service", "gss ",
  "cedi", "cedis", "ghs", "gh¢", "₵", "cocobod", "ecg ", "gridco", "vra ",
  "npp", "ndc", "mahama", "bawumia", "parliament of ghana", "ofori-atta",
  "mtn ghana", "gcb bank", "goil", "tullow", "kosmos", "ghana ports",
  "gpha", "nhis", "ssnit", "petroleum commission", "minerals commission",
];

export function isGhanaRelevant(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return GHANA_MARKERS.some((m) => t.includes(m));
}

/* ------------------------------------------------------------------ */
/* Number extraction                                                   */
/* ------------------------------------------------------------------ */

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

// Spans that must never be treated as statistics.
const DISQUALIFYING_CONTEXT = [
  new RegExp(`\\b(?:${MONTHS})\\b`, "i"),
  /\b(?:19|20)\d{2}\b/,                       // bare year
  /\b\d{1,2}\s*[:.]\s*\d{2}\s*(?:am|pm|gmt|utc)?\b/i, // time
  /\b(?:article|section|clause|act|l\.?i\.?|regulation|no\.?)\s*\d+/i,
  /\b(?:\+?233|0\d{2})[\s-]?\d{3}[\s-]?\d{4}\b/,      // phone
  /\baged?\s+\d{1,2}\b/i,
  /\b\d{1,2}(?:st|nd|rd|th)\b/i,
];

const CURRENCY_RE =
  /(?:GH¢|GHS|GH₵|₵|US\$|USD|\$|£|GBP|€|EUR)\s?\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|bn|million|mn|m\b|thousand|k\b)?/gi;
const CURRENCY_SUFFIX_RE =
  /\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|bn|million|mn|thousand)?\s*(?:cedis?|dollars?|pounds?|euros?)\b/gi;
const PERCENT_RE = /\d[\d,]*(?:\.\d+)?\s*(?:%|per\s?cent|percent|percentage points?|bps|basis points?)/gi;

const UNIT_WORDS = [
  "tonnes", "tonne", "tons", "ton", "barrels", "barrel", "megawatts", "mw",
  "gigawatts", "gw", "kilowatt", "kwh", "kilometres", "kilometers", "km",
  "hectares", "acres", "litres", "liters", "kg", "kilograms", "bags", "units",
  "jobs", "workers", "employees", "customers", "subscribers", "beneficiaries",
  "people", "patients", "students", "teachers", "farmers", "households",
  "arrests", "convictions", "votes", "seats", "companies", "firms", "banks",
  "vehicles", "trucks", "containers", "homes", "houses", "schools", "hospitals",
  "projects", "contracts", "shipments", "flights", "passengers", "traders",
];
const UNIT_RE = new RegExp(
  `\\d[\\d,]*(?:\\.\\d+)?\\s*(?:trillion|billion|bn|million|mn|thousand)?\\s*(?:${UNIT_WORDS.join("|")})\\b`,
  "gi",
);
// Large bare counts, e.g. "17,000 applications" or "4,200".
const LARGE_COUNT_RE = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{4,}(?:\.\d+)?\b/g;

const SCALES: Record<string, number> = {
  trillion: 1e12, billion: 1e9, bn: 1e9, million: 1e6, mn: 1e6, m: 1e6,
  thousand: 1e3, k: 1e3,
};

function scaleOf(s: string): number {
  const m = s.toLowerCase().match(/\b(trillion|billion|bn|million|mn|thousand|k)\b/);
  return m ? SCALES[m[1]] ?? 1 : 1;
}

function numericPart(s: string): number {
  const m = s.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

function contextAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + len + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function contextIsDisqualified(ctx: string, raw: string): boolean {
  // Only disqualify when the raw token itself sits inside a date/time/legal span.
  const idx = ctx.indexOf(raw);
  const window = idx >= 0
    ? ctx.slice(Math.max(0, idx - 25), Math.min(ctx.length, idx + raw.length + 25))
    : ctx;
  return DISQUALIFYING_CONTEXT.some((re) => {
    const m = window.match(re);
    if (!m) return false;
    // The disqualifying match must overlap the number itself.
    return m[0].replace(/\s+/g, "").includes(raw.replace(/\s+/g, "").slice(0, 4)) ||
      raw.replace(/\s+/g, "").includes(m[0].replace(/\s+/g, ""));
  });
}

const MEANING_WORDS =
  /\b(revenue|profit|loss|turnover|sales|income|debt|deficit|surplus|budget|expenditure|spending|investment|inflation|rate|growth|gdp|exports?|imports?|trade|tax|tariff|price|cost|value|reserves?|output|production|capacity|demand|supply|wages?|salary|salaries|funding|grant|loan|bond|bill|auction|market|shares?|dividend|fund|allocation|subsidy|arrears|earnings|assets?|deposits?|premium|payout|fees?|levy|target|jobs?|employment|unemployment|population|beneficiar|customers?|subscribers?|workers?)\b/i;

function pushMatches(
  out: SubstantiveNumber[],
  text: string,
  re: RegExp,
  kind: SubstantiveNumber["kind"],
  baseWeight: number,
) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].trim();
    const value = numericPart(raw);
    if (!isFinite(value)) continue;
    const ctx = contextAround(text, m.index, raw.length);
    if (contextIsDisqualified(ctx, raw)) continue;

    let weight = baseWeight;
    if (MEANING_WORDS.test(ctx)) weight += 2;

    const unit = kind === "percent"
      ? "%"
      : kind === "currency"
      ? (raw.match(/GH¢|GHS|GH₵|₵|cedis?/i) ? "GHS" : raw.match(/£|GBP|pounds?/i) ? "GBP" : raw.match(/€|EUR|euros?/i) ? "EUR" : "USD")
      : (raw.match(new RegExp(`(${UNIT_WORDS.join("|")})`, "i"))?.[1] ?? "count");

    if (kind === "count" && value < 1000 && !MEANING_WORDS.test(ctx)) continue;

    out.push({ raw, value, unit, scale: scaleOf(raw), kind, weight, context: ctx });
  }
}

export function extractSubstantiveNumbers(text: string): SubstantiveNumber[] {
  const clean = (text || "").replace(/\s+/g, " ");
  const out: SubstantiveNumber[] = [];
  pushMatches(out, clean, CURRENCY_RE, "currency", 5);
  pushMatches(out, clean, CURRENCY_SUFFIX_RE, "currency", 5);
  pushMatches(out, clean, PERCENT_RE, "percent", 4);
  pushMatches(out, clean, UNIT_RE, "quantity", 3);
  pushMatches(out, clean, LARGE_COUNT_RE, "count", 2);

  // De-duplicate by normalised raw token.
  const seen = new Set<string>();
  const dedup: SubstantiveNumber[] = [];
  for (const n of out.sort((a, b) => b.weight - a.weight || b.raw.length - a.raw.length)) {
    const key = `${n.value}|${n.unit}|${n.scale}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(n);
  }
  return dedup;
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

const TOPIC_BONUS: Array<[RegExp, number]> = [
  [/\b(economy|economic|fiscal|public finance|budget|treasury|imf|debt)\b/i, 4],
  [/\b(profit|revenue|turnover|results|earnings|dividend|shareholders?)\b/i, 3],
  [/\b(jobs?|employment|unemployment|workers?|layoffs?|recruit)\b/i, 3],
  [/\b(expenditure|spending|allocation|disburse|subsidy|arrears)\b/i, 3],
  [/\b(exports?|imports?|trade|tariff|customs)\b/i, 3],
  [/\b(oil|gas|power|electricity|energy|gold|cocoa|bauxite|lithium|production)\b/i, 3],
  [/\b(population|census|poverty|literacy|mortality|households?)\b/i, 2],
  [/\b(policy|regulation|levy|tax|rate hike|policy rate)\b/i, 2],
  [/\b(compared with|compared to|year-on-year|month-on-month|up from|down from|highest|lowest|record)\b/i, 1],
];

export function rankArticle(numbers: SubstantiveNumber[], text: string): number {
  let score = 0;
  const top = numbers.slice(0, 4);
  for (const n of top) score += n.weight;
  for (const [re, pts] of TOPIC_BONUS) if (re.test(text)) score += pts;
  return score;
}

/* ------------------------------------------------------------------ */
/* Main pre-AI gate                                                    */
/* ------------------------------------------------------------------ */

export function articleText(a: ArticleLike): string {
  return [a.title, a.summary || "", (a.body || "").slice(0, 6000)].join("\n");
}

export function validateStatisticalArticle(a: ArticleLike): ValidationResult {
  const text = articleText(a);
  const ghanaRelevant = isGhanaRelevant(text);
  const numbers = extractSubstantiveNumbers(text);

  if (!ghanaRelevant) {
    return {
      qualifies: false, substantiveNumbers: numbers, ghanaRelevant: false, score: 0,
      reason: "No clear Ghana connection", code: "REJECT_NOT_GHANA",
    };
  }
  if (numbers.length === 0) {
    const hasAnyDigit = /\d/.test(text);
    return {
      qualifies: false, substantiveNumbers: [], ghanaRelevant: true, score: 0,
      reason: hasAnyDigit
        ? "Only dates, years, times or legal references found"
        : "No substantive numerical fact in the article",
      code: hasAnyDigit ? "REJECT_DATE_ONLY" : "REJECT_NO_SUBSTANTIVE_NUMBER",
    };
  }

  // The strongest number must appear in the title or summary, i.e. be central,
  // not incidental deep in the body.
  const headText = `${a.title} ${a.summary || ""} ${(a.body || "").slice(0, 1200)}`;
  const central = numbers.some((n) => headText.includes(n.raw));
  if (!central) {
    return {
      qualifies: false, substantiveNumbers: numbers, ghanaRelevant: true, score: 0,
      reason: "Numbers are incidental, not central to the story",
      code: "REJECT_NO_SUBSTANTIVE_NUMBER",
    };
  }

  return {
    qualifies: true,
    substantiveNumbers: numbers,
    ghanaRelevant: true,
    score: rankArticle(numbers, text),
    reason: "ok",
  };
}

/* ------------------------------------------------------------------ */
/* URL + fingerprint                                                   */
/* ------------------------------------------------------------------ */

export function canonicalUrl(a: ArticleLike): string | null {
  const slug = (a.slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!slug) return null;
  const cat = (a.category_slug || "news").trim().replace(/^\/+|\/+$/g, "");
  return `${SITE_ORIGIN}/${cat}/${slug}/`;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "as", "at", "by",
  "with", "from", "is", "has", "have", "been", "was", "were", "after", "over",
  "its", "his", "her", "their", "new", "says", "said", "will", "that", "this",
]);

export function eventFingerprint(headline: string, primaryNumber?: string): string {
  const tokens = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .sort();
  const uniq = Array.from(new Set(tokens)).slice(0, 8).join("-");
  const num = (primaryNumber || "").replace(/[^0-9.]/g, "");
  return num ? `${uniq}|${num}` : uniq;
}

export function headlineSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    );
  const A = norm(a), B = norm(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/* ------------------------------------------------------------------ */
/* Post-AI verification                                                */
/* ------------------------------------------------------------------ */

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

// Every number a tweet asserts, normalised to a comparable numeric value.
export function tweetNumbers(tweet: string, url: string): Array<{ raw: string; value: number }> {
  const body = tweet.replace(url, " ");
  const out: Array<{ raw: string; value: number }> = [];
  const re = /\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|bn|million|mn|thousand|k)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[0].trim();
    const v = numericPart(raw);
    if (!isFinite(v)) continue;
    out.push({ raw, value: v * scaleOf(raw) });
  }
  return out;
}

function supportedByArticle(value: number, articleValues: number[]): boolean {
  return articleValues.some((av) => {
    if (av === value) return true;
    // tolerate rounding, e.g. 3.63bn stated as 3.6bn
    const denom = Math.max(Math.abs(av), Math.abs(value), 1);
    return Math.abs(av - value) / denom < 0.02;
  });
}

export interface FinalValidationInput {
  tweet: string;
  article: ArticleLike;
  canonicalUrl: string;
  articleNumbers: SubstantiveNumber[];
}

export interface FinalValidationResult {
  valid: boolean;
  code: RejectCode;
  reason: string;
  primaryNumber?: string;
}

export function validateFinalTweet(input: FinalValidationInput): FinalValidationResult {
  const { tweet, article, canonicalUrl: url, articleNumbers } = input;
  const t = (tweet || "").trim();

  if (!t) return { valid: false, code: "REJECT_VALIDATION_FAILED", reason: "empty tweet" };
  if (/^skip$/i.test(t.replace(url, "").trim())) {
    return { valid: false, code: "REJECT_AI_SKIP", reason: "model returned SKIP" };
  }
  if (!url || !/^https:\/\/statsgh\.com\/[^\s]+\/$/.test(url)) {
    return { valid: false, code: "REJECT_URL_MISSING", reason: "no valid canonical url for article" };
  }
  if (!t.includes(url)) {
    return { valid: false, code: "REJECT_URL_MISSING", reason: "tweet does not contain canonical url" };
  }
  const otherUrls = (t.match(/https?:\/\/\S+/g) || []).filter((u) => u !== url);
  if (otherUrls.length) {
    return { valid: false, code: "REJECT_URL_MISMATCH", reason: `unexpected url: ${otherUrls[0]}` };
  }
  if (t.length > MAX_TWEET_LENGTH) {
    return { valid: false, code: "REJECT_OVER_200_CHARS", reason: `${t.length} chars` };
  }
  if (t.includes("#")) {
    return { valid: false, code: "REJECT_VALIDATION_FAILED", reason: "hashtag present" };
  }
  if (EMOJI_RE.test(t)) {
    return { valid: false, code: "REJECT_VALIDATION_FAILED", reason: "emoji present" };
  }
  if (!isGhanaRelevant(`${t} ${article.title}`)) {
    return { valid: false, code: "REJECT_NOT_GHANA", reason: "no Ghana marker in tweet or headline" };
  }

  const nums = tweetNumbers(t, url);
  if (!nums.length) {
    return { valid: false, code: "REJECT_NO_SUBSTANTIVE_NUMBER", reason: "tweet states no number" };
  }
  // A tweet whose only numbers are years/dates is not statistical.
  const bodyNoUrl = t.replace(url, " ");
  const meaningful = nums.filter((n) => {
    const idx = bodyNoUrl.indexOf(n.raw);
    const ctx = bodyNoUrl.slice(Math.max(0, idx - 25), idx + n.raw.length + 25);
    return !contextIsDisqualified(ctx, n.raw);
  });
  if (!meaningful.length) {
    return { valid: false, code: "REJECT_DATE_ONLY", reason: "tweet numbers are dates/years only" };
  }

  const articleValues = articleNumbers.map((n) => n.value * n.scale);
  // also allow raw unscaled values (e.g. "3.6" from "3.6 billion")
  for (const n of articleNumbers) articleValues.push(n.value);

  for (const n of meaningful) {
    const scaled = n.value;
    if (!supportedByArticle(scaled, articleValues)) {
      return {
        valid: false,
        code: "REJECT_AI_HALLUCINATED_NUMBER",
        reason: `number "${n.raw}" not found in article`,
      };
    }
  }

  return { valid: true, code: "QUEUED", reason: "ok", primaryNumber: meaningful[0].raw };
}
