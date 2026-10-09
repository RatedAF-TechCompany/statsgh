import { describe, it, expect } from "vitest";
import { parseV3Output, buildReply } from "./statsgh-output.ts";

const GOOD = "Free SHS suppliers say government owes them GHS250 million\n\nThe Controlled Food Suppliers Association says the money covers food delivered to senior high schools during the 2024/2025 academic year. It has given the government two weeks to begin payment discussions.\n\nThe association says suppliers used bank loans and produce obtained from farmers on credit. Until government pays, they remain unable to settle those debts.";

describe("parseV3Output", () => {
  it("no qualifying (exact)", () => expect(parseV3Output("No qualifying article is available.").kind).toBe("no_qualifying"));
  it("no qualifying (trimmed)", () => expect(parseV3Output("  No qualifying article is available.\n").kind).toBe("no_qualifying"));
  it("no full stop is not no_qualifying", () => expect(parseV3Output("No qualifying article is available").kind).not.toBe("no_qualifying"));
  it("marker split", () => {
    const p = parseV3Output(GOOD + "\n---REPLY---\nSource: [StatsGH article URL]");
    expect(p.post).toBe(GOOD);
    expect(p.markerFound).toBe(true);
    expect(p.modelReply).toBe("Source: [StatsGH article URL]");
  });
  it("no marker, First reply line stripped", () => {
    const p = parseV3Output(GOOD + "\n\nFirst reply: Source: [StatsGH URL]");
    expect(p.post).toBe(GOOD);
    expect(p.warnings).toContain("reply_marker_missing");
    expect(p.warnings).toContain("source_line_stripped_from_post");
  });
  it("CRLF and triple newlines normalise", () => {
    expect(parseV3Output(GOOD.replace(/\n/g, "\r\n")).post).toBe(GOOD);
    expect(parseV3Output(GOOD.replace(/\n\n/g, "\n\n\n")).post).toBe(GOOD);
  });
  it("fence unwrapped", () => expect(parseV3Output("```\n" + GOOD + "\n```").post).toBe(GOOD));
  it("buildReply", () => expect(buildReply({ category_slug: "economy", slug: "x" })).toBe("Source: https://www.statsgh.com/economy/x"));
});
