import { describe, it, expect } from "vitest";
import { crimeGate } from "./crime-gate.ts";
import { weightedLength } from "./x-text.ts";
import { runHouseChecks } from "./statsgh-house-checks.ts";

const URL = "https://www.statsgh.com/economy/inflation-falls";
const article = {
  title: "Inflation falls to 21.5 per cent in September 2026",
  summary: "GSS says the government's cocoa fund reached GHS 1.2 billion cedis; COCOBOD paid farmers.",
  body: "<p>Headline inflation eased from 23.1% to 21.5 per cent, the GSS said.</p>",
};
const ok = { status: "OK", topic_key: "gss|inflation|sept-2026", format: "big_number", key_number: "21.5%" };
const base = "21.5% inflation in Sept 2026, down from 23.1% a month earlier, easing pressure on household budgets across Ghana as food prices cool (GSS, Sept 2026).";
const run = (text: string, mj: any = ok) => runHouseChecks({ post: `${text} ${URL}`, article, url: URL, modelJson: mj });

describe("crime gate", () => {
  it("blocks a section crime-justice article before the model", () => {
    expect(crimeGate({ section: "crime-justice", title: "GDP rises 5%" }).blocked).toBe(true);
  });
});

describe("weighted length", () => {
  it("counts a URL as 23", () => expect(weightedLength("https://www.statsgh.com/a/very-long-slug-indeed-yes")).toBe(23));
  it("counts an emoji as 2", () => expect(weightedLength("📈")).toBe(2));
});

describe("house checks", () => {
  it("baseline post passes", () => expect(run(base).pass).toBe(true));
  it("'21.5 per cent' in article matches '21.5%' in post", () => expect(run(base).checks.numbers_in_article.pass).toBe(true));
  it("'GHS 1.2bn' matches '1.2 billion cedis'", () =>
    expect(run("GHS 1.2bn in the cocoa fund, per GSS, as inflation fell to 21.5% in Sept 2026, easing pressure on Ghana's household budgets.", { ...ok, key_number: "GHS 1.2bn" }).checks.numbers_in_article.pass).toBe(true));
  it("fails when a number is missing from the article", () =>
    expect(run(base.replace("23.1%", "24.7%")).checks.numbers_in_article.pass).toBe(false));
  it("fails on '!'", () => expect(run(base + "!").checks.banned_patterns.pass).toBe(false));
  it("fails on two hashtags", () => expect(run(base + " #Ghana #Inflation").checks.banned_patterns.pass).toBe(false));
  it("fails on GH¢", () => expect(run(base + " GH¢").checks.banned_patterns.pass).toBe(false));
  it("COCOBOD passes", () => expect(run(base.replace("Ghana", "COCOBOD")).checks.banned_patterns.pass).toBe(true));
  it("SHOCKING fails", () => expect(run(base.replace("Ghana", "SHOCKING")).checks.banned_patterns.pass).toBe(false));
});
