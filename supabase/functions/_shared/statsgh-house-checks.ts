// Code-side house checks for statsgh-x-autopost. Never trusts the model's own checks.
import { weightedLength, X_URL_RE } from "./x-text.ts";
import { crimeTextHit } from "./crime-gate.ts";

export interface CheckResult { pass: boolean; detail: string }
export interface HouseCheckInput {
  post: string;
  reply: string;                 // the reply text the code will post
  article: { title?: string | null; summary?: string | null; body?: string | null; published_at?: string | null };
  url: string;                   // https://www.statsgh.com/<category_slug>/<slug>
  modelJson: any;
  primarySource?: { source_name?: string | null; source_url?: string | null } | null; // from rpc get_article_source
  recentTopicKeys?: string[];
  now?: Date;                    // for tests; default new Date()
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
export const GH_FLAG = "\u{1F1EC}\u{1F1ED}"; // 🇬🇭
// Any URL or domain-like text (X auto-links these and they would put a link in the main post).
export const DOMAIN_LIKE_RE = /https?:|:\/\/|\bwww\.|(?:^|[^\p{L}\p{N}@._-])(?:[\p{L}\p{N}-]+\.)+[a-z]{2,24}(?![\p{L}\p{N}])/iu;
export const REPLY_RE = /^Read more: https:\/\/www\.statsgh\.com\/[^\/\s?#]+\/[^\/\s?#]+$/;
export const THEN_NOW_RE = /^.+\n\n.+: .+\n\nNow: .+\n\n\(.+\)$/;
const accraDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Accra" }); // YYYY-MM-DD

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

function isOfficial(src: HouseCheckInput["primarySource"]): boolean {
  if (!src) return false;
  let host = "";
  try { host = src.source_url ? new URL(src.source_url).hostname : ""; } catch { host = ""; }
  return OFFICIAL_SOURCES.some((o) => (host && o.domain.test(host)) || (!!src.source_name && o.aliases.test(src.source_name)));
}

export function runHouseChecks(input: HouseCheckInput): HouseCheckOutput {
  const { post = "", reply = "", article, url, modelJson } = input;
  const now = input.now ?? new Date();
  const checks: Record<string, CheckResult> = {};
  const warnings: string[] = [];
  const set = (k: string, pass: boolean, detail = "") => (checks[k] = { pass, detail });
  const mj = modelJson || {};
  const fmt = String(mj.format);
  const articleText = `${article.title ?? ""} ${article.summary ?? ""} ${stripHtml(article.body ?? "")}`;
  const text = noUrl(post);
  let body = post;
  if (body.startsWith("BREAKING: ")) body = body.slice(10);
  if (body.startsWith(GH_FLAG + " ")) body = body.slice(GH_FLAG.length + 1);
  else if (body.startsWith(GH_FLAG)) body = body.slice(GH_FLAG.length);

  // 1
  set("json_ok", mj.status === "OK" && !!String(post).trim() && !!String(mj.topic_key ?? "").trim() && (fmt === "one_liner" || fmt === "then_now"),
    `status=${mj.status ?? "?"} format=${fmt}`);
  // 2
  const dm = post.match(DOMAIN_LIKE_RE);
  const hasStatsgh = /statsgh/i.test(post);
  set("no_url_in_post", !dm && !hasStatsgh, dm ? dm[0].trim() : hasStatsgh ? "statsgh" : "");
  // 3
  const wl = weightedLength(post);
  const limit = fmt === "then_now" ? 140 : 120;
  set("length_ok", wl <= limit, `weighted ${wl} / limit ${limit}`);
  // 4
  set("layout_ok", fmt === "then_now" ? THEN_NOW_RE.test(post) && !/\r/.test(post) : !/[\r\n]/.test(post), fmt);
  // 5
  if (fmt === "then_now") set("key_number_in_40", true, "n/a then_now");
  else {
    const keyRaw = String(mj.key_number ?? "").trim();
    const keyTok = (keyRaw.match(/\d[\d,]*(?:\.\d+)?/) || [])[0] || (body.match(/\d[\d,]*(?:\.\d+)?/) || [])[0] || "";
    const head = body.slice(0, 40).replace(/,/g, "");
    const keyNorm = keyTok.replace(/,/g, "");
    set("key_number_in_40", !!keyNorm && head.includes(keyNorm), `key "${keyTok}"`);
  }
  // 6
  const artNums = extractNumbers(articleText);
  const missing = extractNumbers(text).filter((n) => !numberInArticle(n, artNums)).map((n) => n.raw.trim());
  set("numbers_in_article", missing.length === 0, missing.length ? `not in article: ${missing.join(", ")}` : "");
  // 7
  set("reply_ok", reply === `Read more: ${url}` && REPLY_RE.test(reply) && url.startsWith("https://www.statsgh.com/"), reply);
  if (mj.reply != null && mj.reply !== reply) warnings.push(`model reply differs from code reply: ${String(mj.reply).slice(0, 120)}`);
  // 8
  const flagCount = post.split(GH_FLAG).length - 1;
  const flagIdx = post.indexOf(GH_FLAG);
  const flagPosOk = flagCount === 0 || flagIdx === 0 || (post.startsWith("BREAKING: ") && flagIdx === 10);
  const rest = flagCount ? post.replace(GH_FLAG, "") : post;
  const otherEmoji = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u20E3|\u200D/u.test(rest);
  set("emoji_ok", flagCount <= 1 && flagPosOk && !otherEmoji,
    flagCount > 1 ? "more than one 🇬🇭" : !flagPosOk ? "🇬🇭 not at start" : otherEmoji ? "other emoji" : "");
  // 9
  const hasBreaking = /\bbreaking\b/i.test(post);
  if (hasBreaking) {
    const fails: string[] = [];
    if (!post.startsWith("BREAKING: ") || (post.match(/\bbreaking\b/gi) || []).length !== 1) fails.push("not_prefix");
    if (mj.breaking !== true) fails.push("model_flag_false");
    if (!article.published_at || accraDate(new Date(article.published_at)) !== accraDate(now)) fails.push("not_published_today_accra");
    if (!isOfficial(input.primarySource)) fails.push("source_not_official");
    set("breaking_ok", fails.length === 0, fails.join(","));
  } else {
    if (mj.breaking === true) warnings.push("model flagged breaking but post has no BREAKING prefix");
    set("breaking_ok", true, "");
  }
  // 10
  const bans: string[] = [];
  if (text.includes("!")) bans.push("exclamation");
  if (text.includes("?")) bans.push("question");
  if ((text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length > 0) bans.push("hashtag");
  if (/(^|\s)@\w+/.test(text)) bans.push("@mention");
  if (/GH¢|₵|\bGHC\b/i.test(text)) bans.push("GH¢/₵/GHC");
  if (/\bSHOCKING\b|\bJUST IN\b/i.test(text)) bans.push("SHOCKING/JUST IN");
  const caps = (body.match(/\b[A-Za-z]{5,}\b/g) || []).filter((w) => w === w.toUpperCase() && !ALLOWED_CAPS.has(w));
  if (caps.length) bans.push(`all caps: ${caps.join(",")}`);
  if (/^\s*according to\b/i.test(body)) bans.push("opens with According to");
  const firstSentence = body.split(/(?<=[.?])\s/)[0] || "";
  if (/\b(reports|says|said) that\b/i.test(firstSentence)) bans.push("'X reports/says that' opening");
  if (/\bthread\b|🧵|you won'?t believe|here'?s why/i.test(text)) bans.push("teaser");
  if (/\b(massive|significant|skyrocket\w*)\b|\bmany ghanaians\b/i.test(text)) bans.push("vague hype word");
  for (const ph of ["record", "highest ever", "first time"]) {
    const re = new RegExp(`\\b${ph}\\b`, "i");
    if (re.test(text) && !re.test(articleText)) bans.push(`'${ph}' not in article`);
  }
  set("banned_patterns", bans.length === 0, bans.join("; "));
  // 11
  set("not_crime", !crimeTextHit(text), "");
  // 12
  const tk = String(mj.topic_key ?? "").trim().toLowerCase();
  const recent = (input.recentTopicKeys || []).map((k) => String(k).trim().toLowerCase());
  set("not_duplicate_topic", !tk || !recent.includes(tk), tk);

  return { pass: Object.values(checks).every((c) => c.pass), checks, warnings };
}

export const failedChecks = (checks: Record<string, CheckResult>) =>
  Object.entries(checks).filter(([, c]) => !c.pass).map(([k]) => k);
