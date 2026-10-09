// Code-side house checks for statsgh-x-autopost. Never trusts the model's own checks.
import { weightedLength, countWords, X_URL_RE, WORDS_MIN, WORDS_MAX } from "./x-text.ts";
import { crimeTextHit } from "./crime-gate.ts";
import { headlineSimilarity } from "./statistical-validator.ts";
import { NO_QUALIFYING, REPLY_MARKER } from "./statsgh-output.ts";

export interface CheckResult { pass: boolean; detail: string }
export interface HouseCheckInput {
  post: string;
  reply: string;                 // the reply text the code will post
  article: { title?: string | null; summary?: string | null; body?: string | null; published_at?: string | null };
  url: string;                   // https://www.statsgh.com/<category_slug>/<slug>
  modelJson?: any;               // ignored (kept for call-site compatibility)
  primarySource?: { source_name?: string | null; source_url?: string | null } | null;
  topicKey?: string | null;      // code-derived
  recentTopicKeys?: string[];
  recentHeadlines?: string[];    // first lines of posts posted in the last 24h
  allowLongPosts?: boolean;      // default true
  maxWeighted?: number;          // default 1000
  blockCrime?: boolean;          // default false
  now?: Date;
}
export interface HouseCheckOutput { pass: boolean; checks: Record<string, CheckResult>; warnings: string[] }

export const OFFICIAL_SOURCES: { name: string; aliases: RegExp; domain: RegExp }[] = [
  { name: "GSS", aliases: /\b(GSS|Ghana Statistical Service)\b/i, domain: /(^|\.)statsghana\.gov\.gh$/i },
  { name: "BoG", aliases: /\b(BoG|Bank of Ghana)\b/i, domain: /(^|\.)bog\.gov\.gh$/i },
  { name: "MoF", aliases: /\b(MoF|Ministry of Finance)\b/i, domain: /(^|\.)(mofep|mof)\.gov\.gh$/i },
  { name: "GRA", aliases: /\b(GRA|Ghana Revenue Authority)\b/i, domain: /(^|\.)gra\.gov\.gh$/i },
  { name: "IMF", aliases: /\b(IMF|International Monetary Fund)\b/i, domain: /(^|\.)imf\.org$/i },
  { name: "World Bank", aliases: /\bWorld Bank\b/i, domain: /(^|\.)worldbank\.org$/i },
  { name: "COCOBOD", aliases: /\b(COCOBOD|Ghana Cocoa Board)\b/i, domain: /(^|\.)cocobod\.gh$/i },
  { name: "PURC", aliases: /\b(PURC|Public Utilities Regulatory Commission)\b/i, domain: /(^|\.)purc\.com\.gh$/i },
  { name: "NPA", aliases: /\b(NPA|National Petroleum Authority)\b/i, domain: /(^|\.)npa\.gov\.gh$/i },
];
// Any URL or domain-like text (X auto-links these and they would put a link in the main post).
export const DOMAIN_LIKE_RE = /https?:|:\/\/|\bwww\.|(?:^|[^\p{L}\p{N}@._-])(?:[\p{L}\p{N}-]+\.)+[a-z]{2,24}(?![\p{L}\p{N}])/iu;
export const REPLY_RE = /^Source: https:\/\/www\.statsgh\.com\/[^\/\s?#]+\/[^\/\s?#]+$/;
export const EMOJI_ANY_RE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u20E3|\u200D|\uFE0F/u;
export const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/u;
export const V3_FORMAT_RE = /^[^\n]+\n\n[^\n]+\n\n[^\n]+$/;

const ALLOWED_CAPS = new Set([
  "GSS", "BoG", "IMF", "ECG", "GRA", "MoF", "GDP", "CPI", "PURC", "COCOBOD", "MPC", "GSE", "SSNIT",
  "NHIS", "VRA", "GRIDCO", "ECOWAS", "GNPC", "NPA", "OPEC", "USD", "GHS",
]);

const MULT: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, bn: 1e9, billion: 1e9, tn: 1e12, trillion: 1e12,
};
const NUM_RE = /(\d[\d,]*(?:\.\d+)?)(?:\s*(k|thousand|mn|m|million|bn|billion|tn|trillion)\b)?/gi;

interface Num { raw: string; mantissa: number; mult: number; decimals: number; value: number }

export function extractNumbers(text: string): Num[] {
  const out: Num[] = [];
  for (const m of (text || "").matchAll(NUM_RE)) {
    const digits = m[1].replace(/,/g, "");
    const mantissa = Number(digits);
    if (!isFinite(mantissa)) continue;
    const mult = m[2] ? MULT[m[2].toLowerCase()] ?? 1 : 1;
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    out.push({ raw: m[0], mantissa, mult, decimals, value: mantissa * mult });
  }
  return out;
}

const stripHtml = (s: string) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9;

export function numberInArticle(n: Num, articleNums: Num[]): boolean {
  for (const a of articleNums) {
    if (near(a.value, n.value)) return true;
    // Rounded to the post's precision, on the post's own scale (e.g. 1.23bn -> 1.2bn).
    const scaled = a.value / n.mult;
    const f = Math.pow(10, n.decimals);
    if (near(Math.round(scaled * f) / f, n.mantissa)) return true;
  }
  return false;
}

const noUrl = (s: string) => (s || "").replace(X_URL_RE, " ");

export function isOfficial(src: HouseCheckInput["primarySource"]): boolean {
  if (!src) return false;
  let host = "";
  try { host = src.source_url ? new URL(src.source_url).hostname : ""; } catch { host = ""; }
  return OFFICIAL_SOURCES.some((o) => (host && o.domain.test(host)) || (!!src.source_name && o.aliases.test(src.source_name)));
}

export function runHouseChecks(input: HouseCheckInput): HouseCheckOutput {
  const { post = "", reply = "", article, url } = input;
  const checks: Record<string, CheckResult> = {};
  const warnings: string[] = [];
  const set = (k: string, pass: boolean, detail = "") => (checks[k] = { pass, detail });
  const articleText = `${article.title ?? ""} ${article.summary ?? ""} ${stripHtml(article.body ?? "")}`;
  const text = noUrl(post);
  const firstLine = post.split("\n")[0] || "";

  set("output_ok", !!post.trim() && post.trim() !== NO_QUALIFYING, post.trim() ? "" : "empty");

  // Format: headline, blank line, paragraph, blank line, paragraph.
  let fmtDetail = "";
  if (/\r/.test(post)) fmtDetail = "carriage return";
  else if (post.includes(REPLY_MARKER)) fmtDetail = "reply marker in post";
  else if (post.split("\n").some((l) => /^\s*(Source:|First reply:)/i.test(l))) fmtDetail = "Source line in post";
  else if (!V3_FORMAT_RE.test(post)) {
    const blocks = post.split(/\n\s*\n/).filter((b) => b.trim());
    if (blocks.length !== 3) fmtDetail = `${blocks.length} blocks`;
    else if (blocks.some((b) => b.includes("\n"))) fmtDetail = "single newline";
    else fmtDetail = "bad layout";
  } else if (post.split("\n\n").some((b) => !b.trim())) fmtDetail = "empty block";
  set("format_ok", !fmtDetail, fmtDetail);

  const words = countWords(post);
  set("word_count_ok", words >= WORDS_MIN && words <= WORDS_MAX, `words ${words} (target 55–100, allowed ${WORDS_MIN}–${WORDS_MAX})`);

  const wl = weightedLength(post);
  const limit = input.allowLongPosts !== false ? (input.maxWeighted ?? 1000) : 280;
  set("length_ok", wl <= limit, `weighted ${wl} / limit ${limit}`);

  const dm = post.match(DOMAIN_LIKE_RE);
  const hasStatsgh = /statsgh/i.test(post);
  set("no_url_in_post", !dm && !hasStatsgh, dm ? dm[0].trim() : hasStatsgh ? "statsgh" : "");

  const artNums = extractNumbers(articleText);
  const missing = extractNumbers(text).filter((n) => !numberInArticle(n, artNums)).map((n) => n.raw.trim());
  set("numbers_in_article", missing.length === 0, missing.length ? `not in article: ${missing.join(", ")}` : "");

  set("reply_ok", reply === `Source: ${url}` && REPLY_RE.test(reply) && url.startsWith("https://www.statsgh.com/"), reply);
  if (input.modelJson?.reply_from_model != null && input.modelJson.reply_from_model !== reply) warnings.push("model reply differs from code reply");
  if (Array.isArray(input.modelJson?.warnings)) warnings.push(...input.modelJson.warnings.map(String));

  set("emoji_ok", !EMOJI_ANY_RE.test(post), EMOJI_ANY_RE.test(post) ? "emoji in post" : "");
  set("no_hashtags", !HASHTAG_RE.test(post), HASHTAG_RE.test(post) ? "hashtag" : "");
  const dash = post.match(/[\u2012\u2013\u2014\u2015]/);
  set("no_long_dash", !dash, dash ? `U+${dash[0].codePointAt(0)!.toString(16).toUpperCase()}` : "");

  const bans: string[] = [];
  if (text.includes("!")) bans.push("exclamation");
  if (text.includes("?")) bans.push("question");
  if (/(^|\s)@\w+/.test(text)) bans.push("@mention");
  if (/GH¢|₵|\bGHC\b/i.test(text)) bans.push("GH¢/₵/GHC");
  if (/\bUSD\b/.test(text) || /(^|[^S])\$/.test(text.replace(/US\$/g, ""))) bans.push("USD/$ (use US$)");
  if (/\bshocking\b|\bjust in\b/i.test(text)) bans.push("Shocking/JUST IN");
  const caps = (text.match(/\b[A-Za-z]{5,}\b/g) || []).filter((w) => w === w.toUpperCase() && !ALLOWED_CAPS.has(w));
  if (caps.length) bans.push(`all caps: ${caps.join(",")}`);
  if (/\bthread\b|🧵|you won'?t believe|here'?s why/i.test(text)) bans.push("teaser");
  if (/\bskyrocket\w*|\bmany ghanaians\b/i.test(text)) bans.push("vague hype word");
  if (/in a significant development/i.test(text)) bans.push("'in a significant development'");
  if (/it is worth noting/i.test(text)) bans.push("'it is worth noting'");
  if (/this highlights the importance of/i.test(text)) bans.push("'this highlights the importance of'");
  if (/\bstakeholders?\b/i.test(text)) bans.push("stakeholder");
  if (/\bgame[- ]changer\b/i.test(text)) bans.push("game-changer");
  if (/\bgroundbreaking\b/i.test(text)) bans.push("groundbreaking");
  if (/\bmassive\b/i.test(text.replace(/"[^"]*"|“[^”]*”/g, " "))) bans.push("massive (unquoted)");
  for (const ph of ["record", "highest ever", "first time"]) {
    const re = new RegExp(`\\b${ph}\\b`, "i");
    if (re.test(text) && !re.test(articleText)) bans.push(`'${ph}' not in article`);
  }
  set("banned_patterns", bans.length === 0, bans.join("; "));

  const tk = String(input.topicKey ?? "").trim().toLowerCase();
  const recent = (input.recentTopicKeys || []).map((k) => String(k).trim().toLowerCase());
  const simHit = (input.recentHeadlines || []).find((h) => h && headlineSimilarity(firstLine, h) >= 0.55);
  set("not_duplicate_topic", !(tk && recent.includes(tk)) && !simHit, simHit ? `similar to: ${simHit.slice(0, 80)}` : tk);

  if (input.blockCrime === true) set("not_crime", !crimeTextHit(text), "");

  if (countWords(firstLine) >= 15) warnings.push("headline has 15 or more words");

  return { pass: Object.values(checks).every((c) => c.pass), checks, warnings };
}

export const failedChecks = (checks: Record<string, CheckResult>) =>
  Object.entries(checks).filter(([, c]) => !c.pass).map(([k]) => k);
