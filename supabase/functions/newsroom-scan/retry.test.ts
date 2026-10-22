import { describe, it, expect, vi } from "vitest";
import { BACKLOG_LIMIT, BACKLOG_HOURS, MAX_ATTEMPTS, failureState, writeWithRetries } from "./retry";

const valid = JSON.stringify({ headline: "Ghana inflation falls", body_html: "<p>Sourced article body</p>", slug: "ghana-inflation-falls" });
const noHalt = () => false;

describe("newsroom retry policy", () => {
  it("caps the backlog at 16 within 48 hours", () => {
    expect(BACKLOG_LIMIT).toBe(16);
    expect(BACKLOG_HOURS).toBe(48);
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
    expect(call.mock.calls).toEqual([[1500], [2200]]);
  });
  it("retries once more after the existing JSON retry fails", async () => {
    const call = vi.fn().mockResolvedValueOnce("{bad").mockResolvedValueOnce("{bad").mockResolvedValue(valid);
    expect((await writeWithRetries(call, JSON.parse, noHalt)).slug).toBe("ghana-inflation-falls");
    expect(call.mock.calls).toEqual([[1500], [2200], [2200]]);
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