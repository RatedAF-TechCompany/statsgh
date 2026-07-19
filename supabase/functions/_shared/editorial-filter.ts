// Tier 1 deterministic editorial gate for StatsGH.
// Zero-cost keyword scan. Returns { reject: boolean, reason?: string }.

const CRIME = ["crime","murder","robbery","arrested","rape","assault","kidnap","killed","stabbed"];
const POLITICS = ["election","ndc","npp","polling station","vote count","party rally","campaign trail"];
const CELEB = ["celebrity","entertainment","gossip","dating","scandal","actress","actor","musician","rapper"];
const SPORTS = ["sports","football","world cup","match result","black stars","premier league","afcon","boxing","athlete"];
const LIFESTYLE = ["lifestyle","fashion","relationships","wellness tips","recipe","travel diary","horoscope"];
const DISASTER = ["weather","flooding","disaster","storm","landslide","earthquake"];
const SPECULATION = ["ai predicts","speculation","could become","might become","rumoured","rumored"];
const INTL_MARKERS = ["usa","united states","brazil","russia","china's","india's","kenya","nigeria","south africa","uk","europe"];

// Mitigators: presence of these keeps an otherwise-rejected article in play.
const ECON_MITIGATORS = [
  "ghs","gh₵","cedi","usd","$","%","percent","inflation","tax","budget","gdp","bog","bank of ghana",
  "parliament","minister","policy","tariff","tonnes","displaced","fraud","audit","investment","jobs",
  "trade","exports","imports","revenue","debt","loan","forex","interest rate","subsidy"
];
const GHANA_MARKERS = ["ghana","accra","kumasi","takoradi","tema","ghanaian","bog","gse","ghs","cedi"];
const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent|million|billion|trillion|bn|m|k|tonnes?|cedis?|ghs)\b/i;

export type Tier1Result = { reject: boolean; reason?: string };

export function tier1Gate(headline: string, summary: string, body: string): Tier1Result {
  const text = `${headline}\n${summary}\n${(body || "").slice(0, 1200)}`.toLowerCase();
  const hasMitigator = ECON_MITIGATORS.some(k => text.includes(k)) || NUMBER_RE.test(text);
  const hasGhana = GHANA_MARKERS.some(k => text.includes(k));

  const hit = (list: string[]) => list.find(k => text.includes(k));

  const celeb = hit(CELEB); if (celeb) return { reject: true, reason: `celebrity/entertainment: "${celeb}"` };
  const sport = hit(SPORTS); if (sport) return { reject: true, reason: `sports: "${sport}"` };
  const life = hit(LIFESTYLE); if (life) return { reject: true, reason: `lifestyle: "${life}"` };
  const spec = hit(SPECULATION); if (spec) return { reject: true, reason: `speculation: "${spec}"` };

  const crime = hit(CRIME);
  if (crime && !hasMitigator) return { reject: true, reason: `crime without economic angle: "${crime}"` };

  const pol = hit(POLITICS);
  if (pol && !NUMBER_RE.test(text)) return { reject: true, reason: `political commentary without data: "${pol}"` };

  const dis = hit(DISASTER);
  if (dis && !hasMitigator) return { reject: true, reason: `disaster without quantified impact: "${dis}"` };

  const intl = hit(INTL_MARKERS);
  if (intl && !hasGhana) return { reject: true, reason: `international with no Ghana nexus: "${intl}"` };

  return { reject: false };
}
