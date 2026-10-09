import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { crimeGate } from "./crime-gate.ts";
import { weightedLength, countWords } from "./x-text.ts";
import { runHouseChecks } from "./statsgh-house-checks.ts";
import { STATSGH_MASTER_PROMPT, PROMPT_VERSION } from "./statsgh-master-prompt.ts";

const url = "https://www.statsgh.com/economy/free-shs-suppliers-arrears";
const reply = "Source: " + url;
const article = {
  title: "Free SHS food suppliers say government owes them GHS250 million",
  summary: "The Controlled Food Suppliers Association says arrears for the 2024/2025 academic year total GHS250 million.",
  body: "<p>The association gave the government two weeks to begin payment talks. Suppliers used bank loans and produce from farmers on credit.</p>",
  published_at: "2026-10-09T08:00:00Z",
};
// v3 Example 2 (64 words)
const GOOD = "Free SHS suppliers say government owes them GHS250 million\n\nThe Controlled Food Suppliers Association says the money covers food delivered to senior high schools during the 2024/2025 academic year. It has given the government two weeks to begin payment discussions.\n\nThe association says suppliers used bank loans and produce obtained from farmers on credit. Until government pays, they remain unable to settle those debts.";
const run = (post: string, extra: any = {}) => runHouseChecks({ post, reply, article, url, topicKey: "article:1", ...extra });
const [H, P1, P2] = GOOD.split("\n\n");
const withP2 = (p2: string) => `${H}\n\n${P1}\n\n${p2}`;
const appendP2 = (s: string) => withP2(`${P2} ${s}`);
// Post with exactly n words: keep headline + P1, fill paragraph two with plain words.
const baseWords = countWords(`${H}\n\n${P1}`);
const nWords = (n: number) => withP2(Array(n - baseWords).fill("debts").join(" ") + ".");
// Valid-format post with exactly `len` weighted characters and few words.
const ofLength = (len: number) => {
  const prefix = `${H}\n\n${P1}\n\n`;
  const remaining = len - weightedLength(prefix);
  const chunks: string[] = [];
  let left = remaining;
  while (left > 0) { const w = Math.min(left === remaining ? 40 : 41, left); chunks.push("x".repeat(left === remaining ? w : w - 1)); left -= w; }
  const p = prefix + chunks.join(" ");
  return p;
};
const pass = (post: string, key: string, extra: any = {}) => run(post, extra).checks[key].pass;

describe("master prompt v3", () => {
  it("sha256 matches", () =>
    expect(createHash("sha256").update(STATSGH_MASTER_PROMPT, "utf8").digest("hex")).toBe("854a9817ced68050b1809858cef4fccb83f0357822a5c16900a60d70bc87d95d"));
  it("length 11697", () => expect(STATSGH_MASTER_PROMPT.length).toBe(11697));
  it("no triple newlines", () => expect(STATSGH_MASTER_PROMPT.includes("\n\n\n")).toBe(false));
  it("version 3.0", () => expect(PROMPT_VERSION).toBe("3.0"));
});

describe("weighted length", () => {
  it("🇬🇭 = 2", () => expect(weightedLength("🇬🇭")).toBe(2));
  it("👍🏽 = 2", () => expect(weightedLength("👍🏽")).toBe(2));
  it("URL = 23", () => expect(weightedLength("https://www.statsgh.com/a/very-long-slug-indeed-yes")).toBe(23));
});

describe("GOOD", () => {
  it("passes every check", () => {
    const r = run(GOOD);
    expect(Object.entries(r.checks).filter(([, c]) => !c.pass)).toEqual([]);
    expect(r.pass).toBe(true);
    expect("not_crime" in r.checks).toBe(false);
  });
  it("64 words", () => expect(countWords(GOOD)).toBe(64));
});

describe("format_ok", () => {
  it("single newlines", () => expect(pass(GOOD.replace(/\n\n/g, "\n"), "format_ok")).toBe(false));
  it("4th paragraph", () => expect(pass(GOOD + "\n\nAnother paragraph here.", "format_ok")).toBe(false));
  it("headline only", () => expect(pass(H, "format_ok")).toBe(false));
  it("Source line in post", () => {
    const r = run(GOOD + "\n\nSource: " + url);
    expect(r.checks.format_ok.pass).toBe(false);
    expect(r.checks.no_url_in_post.pass).toBe(false);
  });
  it("CRLF", () => expect(pass(GOOD.replace(/\n/g, "\r\n"), "format_ok")).toBe(false));
});

describe("word_count_ok (allowed 45-110)", () => {
  it("44 fails", () => expect(pass(nWords(44), "word_count_ok")).toBe(false));
  it("45 passes", () => expect(pass(nWords(45), "word_count_ok")).toBe(true));
  it("110 passes", () => expect(pass(nWords(110), "word_count_ok")).toBe(true));
  it("111 fails", () => expect(pass(nWords(111), "word_count_ok")).toBe(false));
  it("v3 Example 3 (48 words) passes", () => {
    const ex3 = "Road crashes fell 9.48%. Ghana still lost 2,151 people in nine months\n\nThe MTTD says crashes declined in September 2026, while deaths fell 7.82% and injuries dropped 15%.\n\nBut 10,157 crashes killed 2,151 people and injured 12,230 between January and September. That is nearly eight deaths every day.";
    expect(countWords(ex3)).toBe(48);
    expect(pass(ex3, "word_count_ok")).toBe(true);
  });
  it("v3 Example 5 (45 words) passes", () => {
    const ex5 = "Inflation crashed historically, then transport pulled it back\n\nGhana's inflation fell from 23.8% in December 2024 to 3.2% in March 2026.\n\nThe World Bank described the decline as historically sharp. By June, inflation had risen to 5.3%, with higher transport costs contributing to the increase.";
    expect(countWords(ex5)).toBe(45);
    expect(pass(ex5, "word_count_ok")).toBe(true);
  });
});

describe("length_ok", () => {
  it("builder is exact", () => { expect(weightedLength(ofLength(1000))).toBe(1000); expect(weightedLength(ofLength(281))).toBe(281); });
  it("1001 fails", () => expect(pass(ofLength(1001), "length_ok")).toBe(false));
  it("1000 passes", () => expect(pass(ofLength(1000), "length_ok")).toBe(true));
  it("281 passes with long posts", () => expect(pass(ofLength(281), "length_ok", { allowLongPosts: true })).toBe(true));
  it("281 fails without long posts", () => expect(pass(ofLength(281), "length_ok", { allowLongPosts: false })).toBe(false));
});

describe("no_url_in_post", () => {
  for (const u of ["statsgh.com", "www.statsgh.com/x", "https://t.co/x", "bit.ly/x"]) {
    it(u, () => expect(pass(appendP2(u), "no_url_in_post")).toBe(false));
  }
});

describe("numbers_in_article", () => {
  it("GHS251 million fails", () => expect(pass(GOOD.replace("GHS250 million", "GHS251 million"), "numbers_in_article")).toBe(false));
  it("2024/2025 passes", () => expect(pass(GOOD, "numbers_in_article")).toBe(true));
  it("GHS 250m passes", () => expect(pass(GOOD.replace("GHS250 million", "GHS 250m"), "numbers_in_article")).toBe(true));
});

describe("emoji / hashtags / dashes", () => {
  it("🇬🇭 at start", () => expect(pass("🇬🇭 " + GOOD, "emoji_ok")).toBe(false));
  it("📈", () => expect(pass(appendP2("📈"), "emoji_ok")).toBe(false));
  it("👍🏽", () => expect(pass(appendP2("👍🏽"), "emoji_ok")).toBe(false));
  it("#Ghana", () => expect(pass(appendP2("#Ghana"), "no_hashtags")).toBe(false));
  it("em dash", () => expect(pass(appendP2("Payment — soon."), "no_long_dash")).toBe(false));
  it("en dash", () => expect(pass(appendP2("Payment – soon."), "no_long_dash")).toBe(false));
  it("hyphen ok", () => expect(pass(appendP2("The Attorney-General commented."), "no_long_dash")).toBe(true));
});

describe("banned_patterns", () => {
  const bad: [string, string][] = [
    ["Shocking", appendP2("Shocking.")],
    ["stakeholders", appendP2("The stakeholders met.")],
    ["game-changer", appendP2("It is a game-changer.")],
    ["significant development", appendP2("In a significant development, talks began.")],
    ["worth noting", appendP2("It is worth noting that talks began.")],
    ["massive", appendP2("The arrears are massive.")],
    ["BREAKING", "BREAKING: " + GOOD],
    ["GH¢", GOOD.replace("GHS250", "GH¢250")],
    ["?", appendP2("Will government pay?")],
    ["!", appendP2("Pay now!")],
  ];
  for (const [name, post] of bad) it(`${name} fails`, () => expect(pass(post, "banned_patterns")).toBe(false));
  it('"massive" quoted passes', () => expect(pass(appendP2('A supplier called it "massive" debt.'), "banned_patterns")).toBe(true));
  it("According to prosecutors passes", () => expect(pass(withP2("According to prosecutors, suppliers used bank loans."), "banned_patterns")).toBe(true));
  it("says that passes", () => expect(pass(withP2("The association says that suppliers used bank loans."), "banned_patterns")).toBe(true));
});

describe("reply_ok", () => {
  const r = (rep: string) => runHouseChecks({ post: GOOD, reply: rep, article, url, topicKey: "article:1" }).checks.reply_ok.pass;
  it("Read more fails", () => expect(r(`Read more: ${url}`)).toBe(false));
  it("utm fails", () => expect(r(`${reply}?utm_source=x`)).toBe(false));
  it("two spaces fails", () => expect(r(`Source:  ${url}`)).toBe(false));
  it("apex fails", () => expect(r("Source: https://statsgh.com/economy/x")).toBe(false));
  it("Source passes", () => expect(r(`Source: ${url}`)).toBe(true));
});

describe("not_duplicate_topic", () => {
  it("topic key", () => expect(pass(GOOD, "not_duplicate_topic", { recentTopicKeys: ["ARTICLE:1 "] })).toBe(false));
  it("similar headline", () => expect(pass(GOOD, "not_duplicate_topic", { recentHeadlines: ["Free SHS suppliers say government owes them GHS250 million"] })).toBe(false));
  it("unrelated headline", () => expect(pass(GOOD, "not_duplicate_topic", { recentHeadlines: ["Cocoa output rises in Western Region"] })).toBe(true));
});

describe("crime", () => {
  const ex4 = "Prosecutors say a GHS14.85 million SIC Life debt was settled for GHS5 million\n\nThe Attorney-General alleges that Manhyia South MP Nana Agyei Baffour Awuah helped arrange the settlement and that his law firm was allocated GHS2.2 million in legal fees. He has pleaded not guilty.\n\nThe State says the deal caused a GHS9.85 million loss to state-owned SIC Life. The defence says it was a legitimate commercial settlement and disputes that public money was lost.";
  const courtArticle = {
    title: "Prosecutors say GHS14.85 million SIC Life debt was settled for GHS5 million",
    summary: "The prosecution told the court the law firm was allocated GHS2.2 million in fees, causing a GHS9.85 million loss.",
    body: "<p>The MP has pleaded not guilty.</p>",
  };
  const cUrl = "https://www.statsgh.com/crime-justice/sic-life-case";
  const go = (extra: any = {}) => runHouseChecks({ post: ex4, reply: "Source: " + cUrl, article: courtArticle, url: cUrl, topicKey: "article:4", ...extra });
  it("allowed by default", () => {
    const r = go();
    expect("not_crime" in r.checks).toBe(false);
    expect(r.pass).toBe(true);
  });
  it("blockCrime adds failing not_crime", () => {
    const r = go({ blockCrime: true });
    expect(r.checks.not_crime?.pass).toBe(false);
  });
  it("crime gate still blocks crime-justice", () => expect(crimeGate({ section: "crime-justice", title: "x" }).blocked).toBe(true));
});
