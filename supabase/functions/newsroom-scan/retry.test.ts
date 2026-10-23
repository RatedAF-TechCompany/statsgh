import { describe, it, expect, vi } from "vitest";
import { BACKLOG_LIMIT, BACKLOG_HOURS, MAX_ATTEMPTS, DEFAULT_MAX_ARTICLES_PER_RUN, runTimeExceeded, interruptedRunCutoff, failureState, parseArticleJson, writeWithRetries, phaseCandidateLimit, inferTriggerType, parseFeedDate, FRESHNESS_MAX_AGE_MINUTES, BACKLOG_FRESHNESS_MAX_AGE_MINUTES } from "./retry";

const valid = JSON.stringify({ headline: "Ghana inflation falls", body_html: "<p>Sourced article body</p>", slug: "ghana-inflation-falls" });
const noHalt = () => false;

describe("article JSON recovery", () => {
  it("strips markdown fences before parsing", () => {
    expect(parseArticleJson(`\`\`\`json\n${valid}\n\`\`\``)).toEqual(JSON.parse(valid));
  });
  it("extracts the outermost JSON object from surrounding text", () => {
    expect(parseArticleJson(`Here is the JSON:\n${valid}\nEnd.`)).toEqual(JSON.parse(valid));
  });
  it("escapes raw newlines in body_html without changing its content", () => {
    const body = "<p>Ghana inflation falls.\nThe sourced rate is lower.</p>";
    const raw = valid.replace("<p>Sourced article body</p>", body);
    expect(parseArticleJson(raw).body_html).toBe(body);
  });
  it("repairs unescaped double quotes in body_html and headlines", () => {
    const body = '<p class="quote">The bank said "inflation fell".</p>';
    const raw = valid.replace("<p>Sourced article body</p>", body).replace("Ghana inflation falls", 'Bank says "inflation falls"');
    expect(parseArticleJson(raw)).toMatchObject({ body_html: body, headline: 'Bank says "inflation falls"' });
  });
  it("preserves existing escapes, arrays, and nested metadata while repairing", () => {
    const article = { ...JSON.parse(valid), tags: ["Ghana", "rates"], key_data: [{ label: "Inflation", value: "3.2", unit: "%" }], subtitle: 'A "quoted" value with a \\ path' };
    const raw = JSON.stringify(article).replace("<p>Sourced article body</p>", '<p title="value">First\r\nSecond\tline.</p>');
    expect(parseArticleJson(raw)).toEqual({ ...article, body_html: '<p title="value">First\r\nSecond\tline.</p>' });
  });
  it("uses one model call when syntax can be recovered", async () => {
    const call = vi.fn().mockResolvedValue(`\`\`\`json\n${valid.replace("<p>Sourced article body</p>", '<p>He said "lower".\nNext line.</p>')}\n\`\`\``);
    expect((await writeWithRetries(call, JSON.parse, noHalt)).body_html).toBe('<p>He said "lower".\nNext line.</p>');
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("does not complete truncated JSON or invent missing article fields", () => {
    expect(() => parseArticleJson(valid.slice(0, -2))).toThrow();
    expect(parseArticleJson('{"summary":"Only a summary"}')).toEqual({ summary: "Only a summary" });
  });
  it("retries generation only after both parsing attempts fail", async () => {
    const call = vi.fn().mockResolvedValueOnce('{"headline":"Unfinished').mockResolvedValue(valid);
    const parse = vi.fn(JSON.parse);
    expect((await writeWithRetries(call, parse, noHalt)).slug).toBe("ghana-inflation-falls");
    expect(call.mock.calls).toEqual([[6000], [6000]]);
    expect(parse).toHaveBeenCalledTimes(3);
  });
});

describe("newsroom retry policy", () => {
  it("caps the backlog and default combined writing limit at 3 within 12 hours", () => {
    expect(BACKLOG_LIMIT).toBe(3);
    expect(DEFAULT_MAX_ARTICLES_PER_RUN).toBe(3);
    expect(BACKLOG_HOURS).toBe(12);
  });
  it("discovers eight candidates even when three backlog attempts fill the writing cap", () => {
    expect(phaseCandidateLimit(true, 3, 3, 0)).toBe(0);
    expect(phaseCandidateLimit(true, 3, 10, 0)).toBe(2);
    expect(phaseCandidateLimit(false, 3, 3, 3)).toBe(8);
    expect(phaseCandidateLimit(false, 1, 1, 1)).toBe(8);
  });
  it("uses six-hour discovery/publication and twelve-hour queued freshness", () => {
    expect(FRESHNESS_MAX_AGE_MINUTES).toBe(360);
    expect(BACKLOG_FRESHNESS_MAX_AGE_MINUTES).toBe(720);
  });
  it.each(["service_role", "cron_secret_env", "scheduler_token"])("applies the scheduled budget guard for %s", via => {
    expect(inferTriggerType({}, via)).toBe("scheduled");
  });
  it("keeps explicit trigger types and authenticated manual runs", () => {
    expect(inferTriggerType({ triggerType: "scheduled" }, "admin_user")).toBe("scheduled");
    expect(inferTriggerType({}, "admin_user")).toBe("manual");
  });
  it.each([
    ["Fri, 23 Oct 2026 12:00:00 WAT", "2026-10-23T11:00:00.000Z"],
    ["Fri, 23 Oct 2026 12:00:00 BST", "2026-10-23T11:00:00.000Z"],
    ["Fri, 23 Oct 2026 12:00:00 GMT", "2026-10-23T12:00:00.000Z"],
    ["Fri, 23 Oct 2026 12:00:00 UTC", "2026-10-23T12:00:00.000Z"],
    ["Fri, 23 Oct 2026 12:00:00 Z", "2026-10-23T12:00:00.000Z"],
    ["2026-10-23T12:00:00", "2026-10-23T12:00:00.000Z"],
    ["2026-10-23T12:00:00Z", "2026-10-23T12:00:00.000Z"],
    ["2026-10-23T12:00:00+01:00", "2026-10-23T11:00:00.000Z"],
  ])("parses feed date %s", (input, expected) => {
    expect(parseFeedDate(input)?.toISOString()).toBe(expected);
  });
  it("does not invent missing publication dates", () => {
    expect(parseFeedDate("")).toBeNull();
    expect(parseFeedDate("not a date")).toBeNull();
  });
  it("stops starting articles only after 110 seconds", () => {
    expect(runTimeExceeded(1000, 111000)).toBe(false);
    expect(runTimeExceeded(1000, 111001)).toBe(true);
  });
  it("recovers running rows older than ten minutes", () => {
    expect(interruptedRunCutoff(Date.parse("2026-10-23T06:07:00Z"))).toBe("2026-10-23T05:57:00.000Z");
  });
  it("keeps the first two failures pending and dead-letters the third", () => {
    expect(MAX_ATTEMPTS).toBe(3);
    expect(failureState(1, "AI empty")).toMatchObject({ attempts: 1, processing_status: "pending", dead_letter: false });
    expect(failureState(2, "AI empty")).toMatchObject({ attempts: 2, processing_status: "pending", dead_letter: false });
    expect(failureState(3, "AI empty")).toMatchObject({ attempts: 3, processing_status: "failed", dead_letter: true });
  });
  it("accepts a complete AI response without retrying", async () => {
    const call = vi.fn().mockResolvedValue(valid);
    expect((await writeWithRetries(call, JSON.parse, noHalt)).slug).toBe("ghana-inflation-falls");
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("retries empty AI content without substituting RSS copy", async () => {
    const call = vi.fn().mockResolvedValueOnce("").mockResolvedValue(valid);
    expect((await writeWithRetries(call, JSON.parse, noHalt)).body_html).toBe("<p>Sourced article body</p>");
    expect(call.mock.calls).toEqual([[6000], [6000]]);
  });
  it("retries once more after the existing JSON retry fails", async () => {
    const call = vi.fn().mockResolvedValueOnce("{bad").mockResolvedValueOnce("{bad").mockResolvedValue(valid);
    expect((await writeWithRetries(call, JSON.parse, noHalt)).slug).toBe("ghana-inflation-falls");
    expect(call.mock.calls).toEqual([[6000], [6000], [6000]]);
  });
  it.each(["headline", "body_html", "slug"])("retries missing %s and fails without RSS fallback", async (key) => {
    const incomplete = JSON.parse(valid);
    delete incomplete[key];
    const call = vi.fn().mockResolvedValue(JSON.stringify(incomplete));
    await expect(writeWithRetries(call, JSON.parse, noHalt)).rejects.toThrow(`AI output missing ${key}`);
    expect(call).toHaveBeenCalledTimes(3);
  });
  it("returns a useful error after three unparseable responses", async () => {
    const call = vi.fn().mockResolvedValue("not JSON");
    await expect(writeWithRetries(call, JSON.parse, noHalt)).rejects.toThrow("AI generation failed after 3 calls");
    expect(call).toHaveBeenCalledTimes(3);
  });
  it("halts immediately on credits or rate limits", async () => {
    const halt = new Error("Gateway 402");
    const call = vi.fn().mockRejectedValue(halt);
    await expect(writeWithRetries(call, JSON.parse, error => error === halt)).rejects.toBe(halt);
    expect(call).toHaveBeenCalledTimes(1);
  });
});