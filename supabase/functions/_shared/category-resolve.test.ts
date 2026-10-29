import { describe, it, expect } from "vitest";
import { isCrimeStory, resolveCategorySlug, CRIME_CATEGORY } from "./category-resolve.ts";

const ALLOWED = ["macroeconomy", "trade-and-industry", "data-and-research"];

describe("category resolver", () => {
  it("crime slug -> crime-justice", () => expect(resolveCategorySlug({ category_slug: "courts" }, ALLOWED, "macroeconomy")).toBe(CRIME_CATEGORY));
  it("police headline -> crime-justice, never data", () =>
    expect(resolveCategorySlug({ category_slug: "data-and-research", title: "Police arrest 12 over cedi fraud" }, ALLOWED, "macroeconomy")).toBe(CRIME_CATEGORY));
  it("business story mentioning court in passing stays business", () =>
    expect(resolveCategorySlug({ category_slug: "trade-and-industry", title: "Northern Ashanti Mines Seeks Injunction to Block Government Takeover",
      body: "The company went to court. A prosecution is not expected." }, ALLOWED, "macroeconomy")).toBe("trade-and-industry"));
  it("single weak headline word is not enough", () => expect(isCrimeStory({ title: "Supreme Court rules on VAT appeal" })).toBe(false));
  it("weak headline + strong body signals -> crime", () =>
    expect(isCrimeStory({ title: "Court remands ex-CEO", body: "Police said the suspects were charged with stealing." })).toBe(true));
  it("many strong body signals -> crime", () =>
    expect(isCrimeStory({ title: "Update", body: "police arrested suspects charged with robbery" })).toBe(true));
  it("unknown slug -> fallback, never empty", () => expect(resolveCategorySlug({ category_slug: "top-stories" }, ALLOWED, "macroeconomy")).toBe("macroeconomy"));
  it("empty slug -> fallback", () => expect(resolveCategorySlug({}, ALLOWED, "macroeconomy")).toBe("macroeconomy"));
});
