import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { crimeGate } from "./crime-gate.ts";
import { weightedLength } from "./x-text.ts";
import { runHouseChecks } from "./statsgh-house-checks.ts";
import { STATSGH_MASTER_PROMPT, PROMPT_VERSION } from "./statsgh-master-prompt.ts";

const url = "https://www.statsgh.com/economy/inflation-falls";
const reply = "Read more: " + url;
const now = new Date("2026-10-09T12:00:00Z");
const official = { source_name: "Ghana Statistical Service", source_url: "https://statsghana.gov.gh/cpi" };
const article = {
  title: "Inflation falls to 21.5 per cent in September 2026",
  summary: "GSS says the cocoa fund reached GHS 1.2 billion cedis; COCOBOD paid farmers. Policy rate cut to 21.5%.",
  body: "<p>Headline inflation eased from 23.1% to 21.5 per cent, the GSS said. A year earlier it was 23.1%.</p>",
  published_at: "2026-10-09T08:00:00Z",
};
const ok = { status: "OK", topic_key: "gss|inflation|sept-2026", format: "one_liner", key_number: "21.5%", breaking: false };
const ONE = "Ghana's inflation eased to 21.5% in September 2026, from 23.1% a month earlier (GSS)";
const THEN = "Inflation in Ghana\n\nOne year ago: 23.1%\n\nNow: 21.5%\n\n(GSS)";
const run = (post: string, mj: any = ok, extra: any = {}) =>
  runHouseChecks({ post, reply, article, url, modelJson: mj, primarySource: official, now, ...extra });

describe("crime gate", () => {
  it("blocks a section crime-justice article before the model", () => {
    expect(crimeGate({ section: "crime-justice", title: "GDP rises 5%" }).blocked).toBe(true);
  });
});

describe("weighted length", () => {
  it("🇬🇭 = 2", () => expect(weightedLength("🇬🇭")).toBe(2));
  it("📈 = 2", () => expect(weightedLength("📈")).toBe(2));
  it("👍🏽 = 2", () => expect(weightedLength("👍🏽")).toBe(2));
  it("URL = 23", () => expect(weightedLength("https://www.statsgh.com/a/very-long-slug-indeed-yes")).toBe(23));
  it("BREAKING example = 52", () => expect(weightedLength("BREAKING: 🇬🇭 Bank of Ghana cuts policy rate to 21.5%")).toBe(52));
});

describe("house checks v2", () => {
  it("one-liner passes all checks", () => {
    const r = run(ONE);
    expect(r.pass, JSON.stringify(r.checks)).toBe(true);
  });
  it("Then/Now passes in the exact layout", () => {
    const r = run(THEN, { ...ok, format: "then_now" });
    expect(r.pass, JSON.stringify(r.checks)).toBe(true);
  });
  it("Then/Now with single newlines fails layout_ok", () =>
    expect(run(THEN.replace(/\n\n/g, "\n"), { ...ok, format: "then_now" }).checks.layout_ok.pass).toBe(false));
  for (const u of ["statsgh.com", "www.statsgh.com/x", "https://t.co/x", "bit.ly/x"]) {
    it(`fails no_url_in_post for ${u}`, () => expect(run(`${ONE} ${u}`).checks.no_url_in_post.pass).toBe(false));
  }
  it("one-liner of 121 fails length_ok", () => {
    const p = ONE + " " + "a".repeat(120 - ONE.length);
    expect(weightedLength(p)).toBe(121);
    expect(run(p).checks.length_ok.pass).toBe(false);
  });
  it("Then/Now of 141 fails length_ok", () => {
    const p = THEN.replace("Inflation in Ghana", "Inflation in Ghana " + "a".repeat(141 - THEN.length - 1));
    expect(weightedLength(p)).toBe(141);
    expect(run(p, { ...ok, format: "then_now" }).checks.length_ok.pass).toBe(false);
  });
  for (const bad of ["Read more: https://statsgh.com/economy/x", `Read more: ${url}?utm_source=x`, `Read more:  ${url}`]) {
    it(`reply_ok fails for ${bad}`, () => expect(run(ONE, ok, { reply: bad }).checks.reply_ok.pass).toBe(false));
  }
  const BR = "BREAKING: 🇬🇭 Ghana's inflation eased to 21.5% in September 2026 (GSS)";
  const brk = { ...ok, breaking: true };
  it("BREAKING passes when official, today and flagged", () => {
    const r = run(BR, brk);
    expect(r.pass, JSON.stringify(r.checks)).toBe(true);
  });
  it("BREAKING fails if published yesterday", () =>
    expect(run(BR, brk, { article: { ...article, published_at: "2026-10-08T08:00:00Z" } }).checks.breaking_ok.pass).toBe(false));
  it("BREAKING fails for an unofficial source", () =>
    expect(run(BR, brk, { primarySource: { source_name: "Joy News", source_url: "https://myjoyonline.com/x" } }).checks.breaking_ok.pass).toBe(false));
  it("BREAKING fails with no primary source", () => expect(run(BR, brk, { primarySource: null }).checks.breaking_ok.pass).toBe(false));
  it("BREAKING fails with breaking:false", () => expect(run(BR, ok).checks.breaking_ok.pass).toBe(false));
  it("two 🇬🇭 fail emoji_ok", () => expect(run("🇬🇭 " + ONE + " 🇬🇭").checks.emoji_ok.pass).toBe(false));
  it("📈 fails emoji_ok", () => expect(run("📈 " + ONE).checks.emoji_ok.pass).toBe(false));
  it("🇳🇬 fails emoji_ok", () => expect(run("🇳🇬 " + ONE).checks.emoji_ok.pass).toBe(false));
  it("🇬🇭 mid-sentence fails emoji_ok", () => expect(run(ONE.replace("eased", "🇬🇭 eased")).checks.emoji_ok.pass).toBe(false));
  it("#Ghana fails banned_patterns", () => expect(run(ONE + " #Ghana").checks.banned_patterns.pass).toBe(false));
  it("a ? fails banned_patterns", () => expect(run(ONE + "?").checks.banned_patterns.pass).toBe(false));
  it("'21.5 per cent' matches '21.5%' and GHS 1.2bn matches 1.2 billion", () =>
    expect(run("GHS 1.2bn in the cocoa fund as inflation hit 21.5% (GSS)", { ...ok, key_number: "GHS 1.2bn" }).checks.numbers_in_article.pass).toBe(true));
  it("a number missing from the article fails", () =>
    expect(run(ONE.replace("23.1%", "24.7%")).checks.numbers_in_article.pass).toBe(false));
  it("COCOBOD passes, SHOCKING fails", () => {
    expect(run(ONE.replace("(GSS)", "(GSS, COCOBOD)")).checks.banned_patterns.pass).toBe(true);
    expect(run(ONE.replace("eased", "SHOCKING eased")).checks.banned_patterns.pass).toBe(false);
  });
});

describe("master prompt", () => {
  it("is v2 verbatim", () => {
    expect(createHash("sha256").update(STATSGH_MASTER_PROMPT, "utf8").digest("hex"))
      .toBe("bf48e64d8f571fd88cad34c83e1f0ac10dbce469d1d721a5792561a1ec869b92");
    expect(PROMPT_VERSION).toBe("2.0");
  });
});
