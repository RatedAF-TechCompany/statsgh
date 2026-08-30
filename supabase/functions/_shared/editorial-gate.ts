// ============================================================================
// STATSGH FORENSIC EDITORIAL GATE — single source of truth for
//   1. excluded topics (hard sports ban)
//   2. editorial subject classification (allowlist)
//   3. Ghana centrality
//   4. number normalisation
//   5. canonical event fingerprints
//   6. event-level duplicate probability
//   7. finalEditorialValidator / finalTweetValidator
//
// Pure TypeScript. No Deno / Supabase imports so it can be unit tested and
// imported by every edge function. THIS MODULE MUST NOT BE BYPASSED.
// ============================================================================

export type GateCode =
  | "REJECT_SPORTS"
  | "REJECT_ENTERTAINMENT"
  | "REJECT_LIFESTYLE"
  | "REJECT_GOSSIP"
  | "REJECT_CEREMONY"
  | "REJECT_CRIME_NO_DATA"
  | "REJECT_POLITICS_NO_DATA"
  | "REJECT_PROMOTIONAL_PR"
  | "REJECT_NOT_GHANA"
  | "REJECT_OUT_OF_REMIT"
  | "REJECT_NO_SUBSTANTIVE_NUMBER"
  | "REJECT_DATE_ONLY"
  | "REJECT_DUPLICATE_EVENT"
  | "PASS";

export interface StoryLike {
  title: string;
  summary?: string | null;
  body?: string | null;
  category_slug?: string | null;
}

export const ALLOWED_CATEGORIES = [
  "ECONOMY", "PUBLIC_FINANCE", "BANKING", "BUSINESS", "TRADE", "ENERGY",
  "MINING", "AGRICULTURE", "EMPLOYMENT", "TAXATION", "INVESTMENT",
  "INFRASTRUCTURE", "TELECOMS", "ECONOMIC_POLICY", "POPULATION",
  "EDUCATION_DATA", "HEALTH_DATA", "ENVIRONMENT_DATA", "TRANSPORT_DATA",
  "HOUSING_DATA", "PUBLIC_SERVICE_DATA", "MARKETS", "STATISTICAL_REPORT",
  "MEASURABLE_PUBLIC_POLICY",
] as const;
export type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

export const EXCLUDED_CATEGORIES = [
  "SPORTS", "FOOTBALL", "ENTERTAINMENT", "CELEBRITY", "MUSIC", "FILM",
  "FASHION", "LIFESTYLE", "RELATIONSHIPS", "GOSSIP", "HOROSCOPE",
  "RELIGIOUS_CEREMONY", "SOCIAL_EVENT", "PURE_POLITICAL_COMMENTARY",
  "PARTY_POLITICS_WITHOUT_DATA", "CRIME_WITHOUT_STATISTICAL_PUBLIC_INTEREST",
  "FOREIGN_GENERAL_NEWS", "PROMOTIONAL_PR",
] as const;

function text(a: StoryLike): string {
  return `${a.title || ""}\n${a.summary || ""}\n${(a.body || "").slice(0, 4000)}`
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Word-boundary aware matching. Substring matching produced false positives
// (e.g. "nfl" inside "inflation"), which is exactly the kind of silent
// mis-rejection this system must not have.
const termRe = new Map<string, RegExp>();
function matches(t: string, term: string): boolean {
  let re = termRe.get(term);
  if (!re) {
    const esc = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    re = new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i");
    termRe.set(term, re);
  }
  return re.test(t);
}
const has = (t: string, list: string[]) => list.find((k) => matches(t, k)) || null;
const hasRe = (t: string, re: RegExp) => re.test(t);

/* ==========================================================================
   RULE 1 — ABSOLUTE SPORTS BAN
   ========================================================================== */

// Terms that make a story sports FULL STOP. No monetary exception applies.
const SPORTS_HARD_TERMS = [
  "football", "footballer", "premier league", "champions league", "europa league",
  "la liga", "serie a", "bundesliga", "ligue 1", "chelsea", "arsenal",
  "manchester united", "manchester city", "man utd", "liverpool fc", "tottenham",
  "barcelona", "real madrid", "bayern munich", "paris saint-germain", "psg",
  "juventus", "inter milan", "ac milan", "hearts of oak", "asante kotoko",
  "black stars", "black queens", "black satellites", "ghana premier league",
  "transfer fee", "transfer window", "transfer deadline", "signs for",
  "sign for", "signing fee", "loan deal", "free transfer", "release clause",
  "goalkeeper", "midfielder", "striker", "centre-back", "center-back",
  "left-back", "right-back", "winger", "defender for", "squad",
  "afcon", "world cup", "fifa", "uefa", "caf ", "nba", "nfl", "wta", "atp tour",
  "olympics", "commonwealth games", "boxing bout", "heavyweight title",
  "match result", "full-time score", "kick-off", "kickoff", "penalty shootout",
  "league table", "fixtures", "matchday", "man of the match", "hat-trick",
  "cup final", "quarter-final", "semi-final", "athletics championship",
  "cricket", "rugby", "tennis", "basketball game", "sports betting",
  "betting odds", "player valuation", "head coach", "club manager",
];

// Softer sports words: allowed ONLY when the subject is Ghana public money.
const SPORTS_SOFT_TERMS = [
  "sport", "sports", "stadium", "tournament", "athlete", "sporting",
  "national team", "sports ministry",
];

// Public-finance framing that can rescue a sports-adjacent story.
const PUBLIC_MONEY_RE =
  /\b(government|state|ministry|parliament|budget|public (?:funds|purse|expenditure|money)|treasury|taxpayer|allocation|appropriation|audit|auditor[- ]general|expenditure|spent|spending|subvention|procurement)\b/;
const GHANA_MONEY_RE = /\b(gh¢|ghs|gh₵|₵|cedis?)\b/;

export interface ExclusionResult {
  excluded: boolean;
  code: GateCode;
  category: string | null;
  reason: string;
}

const PASS_EX: ExclusionResult = { excluded: false, code: "PASS", category: null, reason: "ok" };

const ENTERTAINMENT = [
  "celebrity", "entertainment news", "showbiz", "actress", "actor ", "movie",
  "film premiere", "nollywood", "afrobeats", "musician", "rapper", "singer",
  "album", "concert", "music video", "award show", "vgma", "grammy", "beef with",
  "reality show", "influencer", "socialite", "netflix series",
];
const LIFESTYLE = [
  "fashion week", "style tips", "wellness tips", "recipe", "travel diary",
  "horoscope", "zodiac", "relationship advice", "dating", "beauty pageant",
  "lifestyle", "skincare",
];
const GOSSIP = ["gossip", "rumour has it", "rumor has it", "slams", "blasts", "shades",
  "reacts to claims", "clapback", "love affair", "baby mama"];
const CEREMONY = ["funeral", "enstoolment", "durbar", "coronation", "church service",
  "crusade", "thanksgiving service", "wedding ceremony", "birthday celebration",
  "anniversary celebration", "commissioning ceremony of the"];
const CRIME = ["murder", "robbery", "rape", "assault", "kidnap", "stabbed",
  "shot dead", "arrested for", "remanded", "court remands", "manhunt", "gang"];
const POLITICS_RHETORIC = ["insults", "descends on", "fires back", "war of words",
  "campaign rally", "party rally", "chairman of the party", "party congress",
  "delegates conference", "political vigilante"];
const PROMO_PR = ["we are pleased to announce", "press release", "launches new brand",
  "unveils new logo", "brand ambassador", "sponsored content", "advertorial",
  "cuts sod for its new branch"];

// A number that materially explains something (RULE 4).
const MATERIAL_NUMBER_RE =
  /(?:gh¢|ghs|gh₵|₵|us\$|usd|\$|£|€)\s?\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|bn|million|mn|thousand)?|\d[\d,]*(?:\.\d+)?\s*(?:%|per\s?cent|percent|percentage points?|basis points?|bps)|\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|million)\s*(?:cedis?|dollars?)|\d[\d,]*(?:\.\d+)?\s*(?:mw|gw|tonnes?|barrels?|jobs?|workers?|hectares?|households?|patients?|students?|beneficiaries)/;

export function isExcludedTopic(a: StoryLike): ExclusionResult {
  const t = text(a);
  const head = `${a.title || ""} ${a.summary || ""}`.toLowerCase();
  const cat = (a.category_slug || "").toLowerCase();

  // Slug segments only — "infrastructure-and-transport" must not match "sport".
  const catSegments = cat.split(/[^a-z]+/).filter(Boolean);
  if (catSegments.some((seg) => /^(sports?|football|entertainment|celebrity|celebrities|showbiz|lifestyle|gossip)$/.test(seg))) {
    return { excluded: true, code: "REJECT_SPORTS", category: "SPORTS", reason: `excluded category_slug: ${cat}` };
  }

  // --- HARD SPORTS BAN ---------------------------------------------------
  const hardSport = has(t, SPORTS_HARD_TERMS);
  if (hardSport) {
    return {
      excluded: true,
      code: "REJECT_SPORTS",
      category: "SPORTS",
      reason: `hard sports term: "${hardSport}" (a transfer fee is not a StatsGH statistic)`,
    };
  }
  const softSport = has(t, SPORTS_SOFT_TERMS);
  if (softSport) {
    // The very limited exception: Ghana public expenditure where sport is incidental.
    const publicMoney = hasRe(t, PUBLIC_MONEY_RE) && hasRe(t, GHANA_MONEY_RE) &&
      hasRe(t, MATERIAL_NUMBER_RE) && isGhanaCentral(a).central;
    if (!publicMoney) {
      return {
        excluded: true,
        code: "REJECT_SPORTS",
        category: "SPORTS",
        reason: `sports subject ("${softSport}") with no Ghana public-expenditure angle`,
      };
    }
  }

  // --- OTHER HARD EXCLUSIONS --------------------------------------------
  // Entertainment / lifestyle are judged on the headline and summary: a passing
  // mention deep in a body must not sink a legitimate economic story.
  const ent = has(head, ENTERTAINMENT);
  if (ent) return { excluded: true, code: "REJECT_ENTERTAINMENT", category: "ENTERTAINMENT", reason: `entertainment: "${ent}"` };
  const life = has(head, LIFESTYLE);
  if (life) return { excluded: true, code: "REJECT_LIFESTYLE", category: "LIFESTYLE", reason: `lifestyle: "${life}"` };
  const gos = has(head, GOSSIP);
  if (gos) return { excluded: true, code: "REJECT_GOSSIP", category: "GOSSIP", reason: `gossip: "${gos}"` };
  const cer = has(head, CEREMONY);
  if (cer && !hasRe(t, MATERIAL_NUMBER_RE)) {
    return { excluded: true, code: "REJECT_CEREMONY", category: "SOCIAL_EVENT", reason: `ceremonial: "${cer}"` };
  }
  const crime = has(t, CRIME);
  if (crime && !(hasRe(t, MATERIAL_NUMBER_RE) && hasRe(t, /\b(fraud|corruption|embezzl|laundering|smuggl|galamsey|tax evasion|procurement|state funds|misappropriat)\b/))) {
    return {
      excluded: true, code: "REJECT_CRIME_NO_DATA",
      category: "CRIME_WITHOUT_STATISTICAL_PUBLIC_INTEREST",
      reason: `crime without statistical public interest: "${crime}"`,
    };
  }
  const pol = has(t, POLITICS_RHETORIC);
  if (pol && !hasRe(t, MATERIAL_NUMBER_RE)) {
    return { excluded: true, code: "REJECT_POLITICS_NO_DATA", category: "PARTY_POLITICS_WITHOUT_DATA", reason: `party politics without data: "${pol}"` };
  }
  const pr = has(t, PROMO_PR);
  if (pr && !hasRe(t, MATERIAL_NUMBER_RE)) {
    return { excluded: true, code: "REJECT_PROMOTIONAL_PR", category: "PROMOTIONAL_PR", reason: `promotional PR: "${pr}"` };
  }

  return PASS_EX;
}

/* ==========================================================================
   RULE 3 — GHANA MUST BE CENTRAL
   ========================================================================== */

const GHANA_CORE = [
  "ghana", "ghanaian", "accra", "kumasi", "tamale", "takoradi", "tema",
  "sekondi", "cape coast", "sunyani", "koforidua", "bolgatanga", "techiman",
  "ashanti region", "greater accra", "volta region", "bank of ghana",
  "ghana stock exchange", "ghana revenue authority", "ghana statistical service",
  "cocobod", "gridco", "ecg", "vra", "gpha", "nhis", "ssnit", "cedi", "cedis",
  "ghs", "gh¢", "₵", "ministry of finance", "parliament of ghana",
  "petroleum commission", "minerals commission", "gipc", "mtn ghana", "gcb bank",
];

const FOREIGN_MARKERS = [
  "united states", "u.s.", "washington", "new york", "united kingdom", "london",
  "brussels", "china", "beijing", "india", "russia", "brazil", "nigeria",
  "kenya", "south africa", "egypt", "morocco", "france", "germany", "japan",
];

export interface GhanaResult { central: boolean; hits: number; reason: string }

export function isGhanaCentral(a: StoryLike): GhanaResult {
  const t = text(a);
  const head = `${a.title || ""} ${a.summary || ""}`.toLowerCase();
  let hits = 0;
  for (const m of GHANA_CORE) if (matches(t, m)) hits++;
  const inHead = GHANA_CORE.some((m) => matches(head, m));

  if (hits === 0) return { central: false, hits, reason: "no Ghana marker anywhere" };

  const foreign = FOREIGN_MARKERS.filter((f) => matches(t, f)).length;
  // Ghana must lead: present in the headline/summary, or mentioned repeatedly
  // and not swamped by a foreign setting.
  if (!inHead && hits < 3) {
    return { central: false, hits, reason: "Ghana mentioned only incidentally in the body" };
  }
  if (!inHead && foreign > 0) {
    return { central: false, hits, reason: "foreign story with incidental Ghana mention" };
  }
  return { central: true, hits, reason: "ok" };
}

/* ==========================================================================
   RULE 2 — EDITORIAL SUBJECT CLASSIFICATION (allowlist)
   ========================================================================== */

const CATEGORY_SIGNALS: Array<[AllowedCategory, RegExp]> = [
  ["PUBLIC_FINANCE", /\b(budget|public debt|debt[- ]to[- ]gdp|fiscal deficit|treasury bills?|t-bills?|bond issuance|government revenue|government expenditure|arrears|imf programme|eurobond|domestic debt|appropriation)\b/],
  ["TAXATION", /\b(tax|taxation|vat|levy|e-levy|customs duty|gra |revenue authority|tax exemption)\b/],
  ["BANKING", /\b(bank of ghana|policy rate|monetary policy|commercial banks?|non-performing loans?|capital adequacy|deposits?|lending rate|mobile money|banking sector)\b/],
  ["MARKETS", /\b(ghana stock exchange|gse composite|share price|market capitalisation|market capitalization|equit(?:y|ies)|bond market|exchange rate|forex|cedi (?:depreciat|appreciat)|treasury auction)\b/],
  ["ECONOMY", /\b(gdp|economic growth|inflation|consumer price index|cpi|producer price|recession|purchasing power|economy grew|economic outlook)\b/],
  ["ECONOMIC_POLICY", /\b(economic policy|fiscal policy|structural reform|policy framework|imf review|world bank programme)\b/],
  ["TRADE", /\b(exports?|imports?|trade balance|trade deficit|trade surplus|tariff|afcfta|port volumes?|shipment)\b/],
  ["ENERGY", /\b(electricity|power sector|megawatt|mw\b|generation capacity|fuel price|petrol|diesel|lpg|oil production|gas|refinery|eca|energy sector levy)\b/],
  ["MINING", /\b(gold|bauxite|manganese|lithium|mining|galamsey|mineral (?:revenue|royalt)|ounces?)\b/],
  ["AGRICULTURE", /\b(cocoa|farmers?|harvest|crop|maize|rice production|poultry|fertiliser|fertilizer|agric|agriculture)\b/],
  ["EMPLOYMENT", /\b(jobs?|employment|unemployment|layoffs?|recruitment|wages?|salary|salaries|labour force|minimum wage)\b/],
  ["INVESTMENT", /\b(investment|fdi|foreign direct investment|capital injection|investor|gipc|funding round)\b/],
  ["INFRASTRUCTURE", /\b(road construction|highway|railway|port (?:expansion|infrastructure)|bridge|interchange|water project|housing project|dock|terminal)\b/],
  ["TELECOMS", /\b(telecom|subscribers?|data bundle|spectrum|4g|5g|nca |mobile network)\b/],
  ["BUSINESS", /\b(company|firm|revenue|profit|turnover|earnings|results|dividend|shareholders?|acquisition|merger|expansion|factory)\b/],
  ["POPULATION", /\b(census|population|birth rate|migration|households?|demographic)\b/],
  ["EDUCATION_DATA", /\b(students?|enrolment|enrollment|schools?|bece|wassce|teachers?|free shs|literacy rate)\b/],
  ["HEALTH_DATA", /\b(patients?|hospitals?|mortality|vaccination|malaria|cholera|health insurance|nhis|disease cases|clinics?)\b/],
  ["ENVIRONMENT_DATA", /\b(emissions|pollution|deforestation|climate|flood damage|sanitation|waste)\b/],
  ["TRANSPORT_DATA", /\b(transport fares?|vehicles?|traffic|airport passengers?|rail passengers?|trotro|haulage)\b/],
  ["HOUSING_DATA", /\b(housing deficit|rent|mortgage|affordable housing|property prices?)\b/],
  ["PUBLIC_SERVICE_DATA", /\b(civil service|public sector workers?|payroll|pension|ssnit|service delivery)\b/],
  ["STATISTICAL_REPORT", /\b(survey|report finds|statistical service|data shows|study of \d|research finds|index ranks)\b/],
  ["MEASURABLE_PUBLIC_POLICY", /\b(policy target|programme beneficiaries|rollout|implementation phase|government plans to spend)\b/],
];

export interface SubjectResult {
  allowed: boolean;
  primary_category: string;
  reason: string;
  code: GateCode;
}

export function classifyEditorialSubject(a: StoryLike): SubjectResult {
  const ex = isExcludedTopic(a);
  if (ex.excluded) {
    return { allowed: false, primary_category: ex.category || "EXCLUDED", reason: ex.reason, code: ex.code };
  }

  const gh = isGhanaCentral(a);
  if (!gh.central) {
    return { allowed: false, primary_category: "FOREIGN_GENERAL_NEWS", reason: gh.reason, code: "REJECT_NOT_GHANA" };
  }

  const t = text(a);
  const head = `${a.title || ""} ${a.summary || ""}`.toLowerCase();
  let best: { cat: AllowedCategory; score: number } | null = null;
  for (const [cat, re] of CATEGORY_SIGNALS) {
    let score = 0;
    if (re.test(head)) score += 3;
    if (re.test(t)) score += 1;
    if (score && (!best || score > best.score)) best = { cat, score };
  }

  if (!best) {
    return {
      allowed: false,
      primary_category: "UNCLASSIFIED",
      reason: "subject does not fall inside the StatsGH editorial remit",
      code: "REJECT_OUT_OF_REMIT",
    };
  }

  if (!hasRe(t, MATERIAL_NUMBER_RE)) {
    return {
      allowed: false,
      primary_category: best.cat,
      reason: "no material (non-decorative) number supporting the subject",
      code: "REJECT_NO_SUBSTANTIVE_NUMBER",
    };
  }

  return { allowed: true, primary_category: best.cat, reason: "ok", code: "PASS" };
}

/* ==========================================================================
   RULE 6 — NUMBER NORMALISATION
   ========================================================================== */

const SCALES: Record<string, number> = {
  trillion: 1e12, tn: 1e12, billion: 1e9, bn: 1e9, b: 1e9,
  million: 1e6, mn: 1e6, m: 1e6, thousand: 1e3, k: 1e3,
};

export interface NormalisedStat {
  unit: "GHS" | "USD" | "GBP" | "EUR" | "PCT" | "NUM";
  value: number;
  canonical: string;
}

export function normaliseStatistic(raw: string): NormalisedStat | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const numMatch = s.replace(/\s(?=\d{3}\b)/g, "").match(/\d+(?:\.\d+)?/);
  if (!numMatch) return null;
  let value = parseFloat(numMatch[0]);

  const scaleMatch = s.match(/\d[\d.,]*\s*(trillion|tn|billion|bn|million|mn|thousand|k|b|m)\b/);
  if (scaleMatch) value *= SCALES[scaleMatch[1]] ?? 1;

  let unit: NormalisedStat["unit"] = "NUM";
  if (/%|per\s?cent|percent|percentage/.test(s)) unit = "PCT";
  else if (/gh¢|ghs|gh₵|₵|cedis?/.test(s)) unit = "GHS";
  else if (/us\$|usd|\$|dollars?/.test(s)) unit = "USD";
  else if (/£|gbp|pounds?/.test(s)) unit = "GBP";
  else if (/€|eur|euros?/.test(s)) unit = "EUR";

  // Round to 4 significant digits so 13.80bn and 13.8bn collapse together.
  const rounded = Number(value.toPrecision(4));
  return { unit, value: rounded, canonical: `${unit}:${rounded}` };
}

const STAT_SCAN_RE =
  /(?:gh¢|ghs|gh₵|₵|us\$|usd|\$|£|€)\s?\d[\d,]*(?:\.\d+)?\s*(?:trillion|tn|billion|bn|million|mn|thousand|k)?|\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|million|thousand)?\s*(?:cedis?|dollars?|pounds?|euros?)|\d[\d,]*(?:\.\d+)?\s*(?:%|per\s?cent|percent|percentage points?|basis points?|bps)|\d[\d,]*(?:\.\d+)?\s*(?:trillion|billion|million)\b/gi;

export function extractNormalisedStats(input: string): NormalisedStat[] {
  const out: NormalisedStat[] = [];
  const seen = new Set<string>();
  const src = (input || "").replace(/\s+/g, " ");
  let m: RegExpExecArray | null;
  STAT_SCAN_RE.lastIndex = 0;
  while ((m = STAT_SCAN_RE.exec(src)) !== null) {
    const n = normaliseStatistic(m[0]);
    if (!n || seen.has(n.canonical)) continue;
    // Bare years are never statistics.
    if (n.unit === "NUM" && n.value >= 1900 && n.value <= 2100 && Number.isInteger(n.value)) continue;
    seen.add(n.canonical);
    out.push(n);
  }
  return out;
}

/* ==========================================================================
   RULE 5 — CANONICAL EVENT FINGERPRINT
   ========================================================================== */

const KNOWN_ENTITIES = [
  "bank of ghana", "ghana revenue authority", "ghana statistical service",
  "ministry of finance", "cocobod", "ghana ports and harbours authority",
  "gpha", "ecg", "gridco", "vra", "ssnit", "nhis", "gipc", "ghana stock exchange",
  "parliament", "imf", "world bank", "mtn ghana", "gcb bank", "goil",
  "tullow", "kosmos", "ghana water", "nca", "national petroleum authority",
  "controller and accountant general", "auditor-general", "government of ghana",
];

const ACTION_VERBS: Array<[string, RegExp]> = [
  ["cut", /\b(cut|cuts|reduce[ds]?|lower(?:s|ed)?|slash(?:es|ed)?)\b/],
  ["raise", /\b(raise[ds]?|hike[ds]?|increase[ds]?|rise[sn]?|rose|up by)\b/],
  ["fall", /\b(fall|falls|fell|drop(?:s|ped)?|decline[ds]?|down to|eased)\b/],
  ["invest", /\b(invest(?:s|ed|ment)?|inject(?:s|ed)?|commit(?:s|ted)?)\b/],
  ["spend", /\b(spen[dt]s?|disburse[ds]?|allocat(?:e|es|ed|ion))\b/],
  ["report", /\b(report(?:s|ed)?|record(?:s|ed)?|post(?:s|ed)?|announce[ds]?|reveal(?:s|ed)?)\b/],
  ["issue", /\b(issue[ds]?|auction(?:s|ed)?|raise[ds]? .* bond)\b/],
  ["grow", /\b(grow|grew|grows|expand(?:s|ed)?|surge[ds]?)\b/],
  ["approve", /\b(approve[ds]?|pass(?:es|ed)?|ratif(?:y|ies|ied))\b/],
];

const PERIOD_RE =
  /\b(q[1-4]\s?20\d{2}|20\d{2}|first quarter|second quarter|third quarter|fourth quarter|january|february|march|april|may|june|july|august|september|october|november|december)\b/;

export interface EventDescriptor {
  primary_entity: string;
  action: string;
  primary_statistic: string;
  normalised_statistic: string;
  period: string;
  category: string;
  fingerprint: string;
}

export function buildEventDescriptor(a: StoryLike, category?: string): EventDescriptor {
  const t = text(a);
  const head = `${a.title || ""} ${a.summary || ""}`.toLowerCase();

  let entity = KNOWN_ENTITIES.find((e) => matches(head, e)) ||
    KNOWN_ENTITIES.find((e) => matches(t, e)) || "";
  if (!entity) {
    // Fall back to the leading proper-noun phrase of the headline.
    const m = (a.title || "").match(/\b([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,2})/);
    entity = (m?.[1] || "ghana").toLowerCase();
  }

  const action = ACTION_VERBS.find(([, re]) => re.test(head))?.[0] ||
    ACTION_VERBS.find(([, re]) => re.test(t))?.[0] || "report";

  const stats = extractNormalisedStats(`${head} ${t.slice(0, 1500)}`);
  const primary = stats[0];
  const period = (head.match(PERIOD_RE)?.[1] || t.match(PERIOD_RE)?.[1] || "undated")
    .replace(/\s+/g, "");

  const cat = (category || classifyEditorialSubject(a).primary_category || "GENERAL").toUpperCase();

  const fingerprint = [
    entity.replace(/[^a-z0-9]+/g, "-"),
    action,
    primary?.canonical ?? "nostat",
    period,
    cat,
  ].join("|");

  return {
    primary_entity: entity,
    action,
    primary_statistic: primary ? String(primary.value) : "",
    normalised_statistic: primary?.canonical ?? "",
    period,
    category: cat,
    fingerprint,
  };
}

export function buildEventFingerprint(a: StoryLike, category?: string): string {
  return buildEventDescriptor(a, category).fingerprint;
}

/* ==========================================================================
   RULE 7 — SEMANTIC EVENT MATCHING / duplicate probability
   ========================================================================== */

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "for", "to", "and", "as", "at", "by",
  "with", "from", "is", "has", "have", "been", "was", "were", "after", "over",
  "its", "his", "her", "their", "new", "says", "said", "will", "that", "this",
  "ghana", "ghanaian",
]);

function tokens(s: string): Set<string> {
  return new Set(
    (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size);
}

export interface DuplicateAssessment {
  duplicate_probability: number;
  verdict: "DUPLICATE" | "REVIEW" | "DISTINCT";
  detail: string;
}

export function assessDuplicate(
  candidate: { descriptor: EventDescriptor; headline: string },
  existing: { descriptor: EventDescriptor; headline: string },
): DuplicateAssessment {
  const c = candidate.descriptor, e = existing.descriptor;
  const entity = c.primary_entity && c.primary_entity === e.primary_entity ? 1
    : jaccard(tokens(c.primary_entity), tokens(e.primary_entity));
  const action = c.action === e.action ? 1 : 0;
  const stat = c.normalised_statistic && c.normalised_statistic === e.normalised_statistic ? 1 : 0;
  const period = c.period === e.period ? 1 : 0;
  const cat = c.category === e.category ? 1 : 0;
  const headline = jaccard(tokens(candidate.headline), tokens(existing.headline));

  const p =
    entity * 0.25 +
    action * 0.10 +
    stat * 0.30 +
    period * 0.05 +
    cat * 0.05 +
    headline * 0.25;

  const prob = Number(p.toFixed(3));
  const verdict = prob >= 0.80 ? "DUPLICATE" : prob >= 0.65 ? "REVIEW" : "DISTINCT";
  return {
    duplicate_probability: prob,
    verdict,
    detail: `entity=${entity.toFixed(2)} action=${action} stat=${stat} period=${period} cat=${cat} headline=${headline.toFixed(2)}`,
  };
}

/* ==========================================================================
   RULE 8 — MATERIAL UPDATE TEST
   ========================================================================== */

export function isMaterialUpdate(
  candidate: { descriptor: EventDescriptor },
  existing: { descriptor: EventDescriptor },
): boolean {
  const c = candidate.descriptor, e = existing.descriptor;
  if (!c.normalised_statistic || !e.normalised_statistic) return false;
  if (c.normalised_statistic === e.normalised_statistic) return false;
  const cv = Number(c.primary_statistic), ev = Number(e.primary_statistic);
  if (!isFinite(cv) || !isFinite(ev) || ev === 0) return true;
  return Math.abs(cv - ev) / Math.abs(ev) >= 0.10; // >=10% change = material
}

/* ==========================================================================
   FINAL SAFETY NETS
   ========================================================================== */

export interface FinalGateResult {
  ok: boolean;
  code: GateCode;
  reason: string;
  primary_category?: string;
  fingerprint?: string;
}

/** Runs immediately before INSERT into public.articles. Defence in depth. */
export function finalEditorialValidator(
  a: StoryLike,
  opts: { knownFingerprints?: Set<string> } = {},
): FinalGateResult {
  const ex = isExcludedTopic(a);
  if (ex.excluded) return { ok: false, code: ex.code, reason: `finalEditorialValidator: ${ex.reason}` };

  const subject = classifyEditorialSubject(a);
  if (!subject.allowed) {
    return { ok: false, code: subject.code, reason: `finalEditorialValidator: ${subject.reason}` };
  }

  const fp = buildEventFingerprint(a, subject.primary_category);
  if (opts.knownFingerprints?.has(fp)) {
    return { ok: false, code: "REJECT_DUPLICATE_EVENT", reason: `finalEditorialValidator: event already published (${fp})`, fingerprint: fp };
  }

  return { ok: true, code: "PASS", reason: "ok", primary_category: subject.primary_category, fingerprint: fp };
}

/** Runs immediately before POST to X. Independent of the article-side gate. */
export function finalTweetValidator(
  a: StoryLike,
  opts: { tweetedFingerprints?: Set<string>; fingerprint?: string } = {},
): FinalGateResult {
  const ex = isExcludedTopic(a);
  if (ex.excluded) return { ok: false, code: ex.code, reason: `finalTweetValidator: ${ex.reason}` };

  const subject = classifyEditorialSubject(a);
  if (!subject.allowed) {
    return { ok: false, code: subject.code, reason: `finalTweetValidator: ${subject.reason}` };
  }

  const fp = opts.fingerprint || buildEventFingerprint(a, subject.primary_category);
  if (opts.tweetedFingerprints?.has(fp)) {
    return { ok: false, code: "REJECT_DUPLICATE_EVENT", reason: `finalTweetValidator: event already tweeted (${fp})`, fingerprint: fp };
  }
  return { ok: true, code: "PASS", reason: "ok", primary_category: subject.primary_category, fingerprint: fp };
}
