import { describe, it, expect } from "vitest";
import {
  isExcludedTopic,
  classifyEditorialSubject,
  isGhanaCentral,
  normaliseStatistic,
  buildEventDescriptor,
  assessDuplicate,
  isMaterialUpdate,
  finalEditorialValidator,
  finalTweetValidator,
  classifyNumbers,
  hasSubstantiveStatistic,
} from "./editorial-gate";

const s = (title: string, summary = "", body = "") => ({ title, summary, body });

describe("RULE 1 — absolute sports ban", () => {
  it("rejects a football transfer even with a huge number", () => {
    const r = isExcludedTopic(s(
      "Arsenal sign Ghanaian midfielder for £30 million",
      "The Premier League club completed the transfer on deadline day.",
    ));
    expect(r.excluded).toBe(true);
    expect(r.code).toBe("REJECT_SPORTS");
  });

  it("rejects Black Stars match coverage", () => {
    expect(isExcludedTopic(s("Black Stars beat Nigeria 2-1 in AFCON qualifier")).excluded).toBe(true);
  });

  it("rejects a stadium story with no public-money angle", () => {
    expect(isExcludedTopic(s("New sports stadium opened in Kumasi to host tournament")).excluded).toBe(true);
  });

  it("allows a genuine Ghana public-expenditure story that mentions sport", () => {
    const r = isExcludedTopic(s(
      "Government spent GHS 195 million on hosting the games, Auditor-General finds",
      "Ministry of Finance figures show the state expenditure exceeded the approved budget by 31%.",
      "Parliament was told the taxpayer covered GHS 195 million of the sports tournament cost in Accra.",
    ));
    expect(r.excluded).toBe(false);
  });
});

describe("RULE 2/3 — allowlist and Ghana centrality", () => {
  it("accepts a Bank of Ghana policy-rate story", () => {
    const r = classifyEditorialSubject(s(
      "Bank of Ghana cuts policy rate to 21.5%",
      "The Monetary Policy Committee lowered the rate by 200 basis points.",
      "Bank of Ghana said inflation in Accra eased, cedi stability improved.",
    ));
    expect(r.allowed).toBe(true);
    expect(r.primary_category).toBe("BANKING");
  });

  it("rejects a foreign story with only an incidental Ghana mention", () => {
    const r = classifyEditorialSubject(s(
      "Samsung reports $13.8 billion quarterly profit",
      "The South Korean firm beat forecasts.",
      "Sales rose across Asia and Europe. The company also sells phones in Ghana.",
    ));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("REJECT_NOT_GHANA");
  });

  it("rejects a Ghana story with no number", () => {
    const r = classifyEditorialSubject(s(
      "Bank of Ghana governor speaks on the economy in Accra",
      "He addressed bankers about inflation and growth.",
    ));
    expect(r.code).toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
  });

  it("rejects an out-of-remit Ghana story that happens to contain a number", () => {
    const r = classifyEditorialSubject(s(
      "Accra church holds 40th anniversary service",
      "About 5,000 worshippers attended in Ghana.",
    ));
    expect(r.allowed).toBe(false);
  });

  it("does not treat a body-only Ghana mention as central", () => {
    expect(isGhanaCentral(s("US inflation hits 3.1%", "", "Washington data. Ghana was not mentioned much.")).central)
      .toBe(false);
  });
});

describe("RULE 4/6 — numbers", () => {
  it("rejects date-only stories", () => {
    const r = classifyEditorialSubject(s(
      "Ghana budget will be presented in Parliament on 11 November 2026",
      "The Ministry of Finance confirmed the date.",
    ));
    expect(r.code).toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
  });

  it("normalises scale and currency", () => {
    expect(normaliseStatistic("GHS 13.8 billion")).toMatchObject({ unit: "GHS", value: 13800000000 });
    expect(normaliseStatistic("13,800,000,000 cedis")?.unit).toBe("GHS");
    expect(normaliseStatistic("21.5%")).toMatchObject({ unit: "PCT", value: 21.5 });
  });

  it("collapses equivalent written forms to one canonical value", () => {
    expect(normaliseStatistic("GHS 13.80bn")?.canonical).toBe(normaliseStatistic("GHS 13.8 billion")?.canonical);
  });
});

describe("RULE 5/7 — canonical event identity and duplicate detection", () => {
  const a = s(
    "Bank of Ghana cuts policy rate to 21.5% in 2026",
    "MPC lowered the rate.",
    "Bank of Ghana reduced the policy rate to 21.5% in Accra.",
  );
  const b = s(
    "BoG reduces benchmark interest rate to 21.5% — Bank of Ghana",
    "The central bank lowered its rate.",
    "Bank of Ghana cut the policy rate to 21.5% in 2026, officials in Accra said.",
  );
  const cDifferent = s(
    "Ghana inflation falls to 11.2% in 2026",
    "Ghana Statistical Service data.",
    "The Ghana Statistical Service said consumer price inflation fell to 11.2% in Accra.",
  );

  it("gives the same event the same fingerprint components", () => {
    const da = buildEventDescriptor(a), db = buildEventDescriptor(b);
    expect(da.normalised_statistic).toBe(db.normalised_statistic);
    expect(da.primary_entity).toBe(db.primary_entity);
  });

  it("flags the same event from two sources as a duplicate", () => {
    const r = assessDuplicate(
      { descriptor: buildEventDescriptor(a), headline: a.title },
      { descriptor: buildEventDescriptor(b), headline: b.title },
    );
    expect(r.duplicate_probability).toBeGreaterThanOrEqual(0.65);
  });

  it("treats a genuinely different story as distinct", () => {
    const r = assessDuplicate(
      { descriptor: buildEventDescriptor(a), headline: a.title },
      { descriptor: buildEventDescriptor(cDifferent), headline: cDifferent.title },
    );
    expect(r.verdict).toBe("DISTINCT");
  });
});

describe("RULE 8 — material update", () => {
  it("treats a >=10% revision as material", () => {
    const older = buildEventDescriptor(s("Ghana debt hits GHS 700 billion in 2026", "", "Ministry of Finance reported GHS 700 billion debt in Accra."));
    const newer = buildEventDescriptor(s("Ghana debt revised to GHS 800 billion in 2026", "", "Ministry of Finance revised debt to GHS 800 billion in Accra."));
    expect(isMaterialUpdate({ descriptor: newer }, { descriptor: older })).toBe(true);
  });

  it("treats a restatement of the same number as not material", () => {
    const d = buildEventDescriptor(s("Ghana debt hits GHS 700 billion in 2026", "", "Ministry of Finance reported GHS 700 billion in Accra."));
    expect(isMaterialUpdate({ descriptor: d }, { descriptor: d })).toBe(false);
  });
});

describe("final safety nets", () => {
  const good = s(
    "Ghana Revenue Authority collects GHS 45.2 billion in 2026",
    "Tax revenue rose 18% year on year.",
    "The Ghana Revenue Authority said tax collections in Accra reached GHS 45.2 billion.",
  );

  it("passes a qualifying article and returns a fingerprint", () => {
    const r = finalEditorialValidator(good);
    expect(r.ok).toBe(true);
    expect(r.fingerprint).toBeTruthy();
  });

  it("blocks publication of an already-claimed event", () => {
    const fp = finalEditorialValidator(good).fingerprint!;
    const r = finalEditorialValidator(good, { knownFingerprints: new Set([fp]) });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("REJECT_DUPLICATE_EVENT");
  });

  it("blocks tweeting a sports story even if it somehow got published", () => {
    const r = finalTweetValidator(s("Ghana Premier League club spends GHS 4 million on new striker"));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("REJECT_SPORTS");
  });

  it("blocks tweeting an event already tweeted", () => {
    const fp = finalTweetValidator(good).fingerprint!;
    expect(finalTweetValidator(good, { tweetedFingerprints: new Set([fp]) }).code)
      .toBe("REJECT_DUPLICATE_EVENT");
  });
});

describe("RULE 4b — numeric fact classification (Joy FM regression)", () => {
  const joyfm = s(
    "Joy FM Discount Fair Returns to Ease Back-to-School Costs",
    "Joy FM has relaunched its Back-to-School Discount Fair, providing Ghanaian families with an opportunity to purchase school supplies at reduced prices. The two-day event aims to alleviate financial burdens.",
    "Joy FM has brought back its annual Back-to-School Discount Fair, offering families discounted prices on essential school supplies. The two-day event will gather numerous vendors and businesses. Ghanaian households often face significant expenditure spikes at the start of each academic term. The Joy FM Back-to-School Discount Fair is scheduled for September 4-5. It will run daily from 10 a.m. to 5 p.m. at the Joy FM Car Park.",
  );

  it("rejects the Joy FM discount fair", () => {
    const r = classifyEditorialSubject(joyfm);
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
    expect(finalEditorialValidator(joyfm).ok).toBe(false);
  });

  it("classifies its numbers as logistical/calendar only", () => {
    const kinds = new Set(classifyNumbers(
      "The two-day event runs September 4-5 from 10 a.m. to 5 p.m.",
    ).map((f) => f.klass));
    expect(kinds.has("PRIMARY_CURRENT_STATISTIC")).toBe(false);
    expect(kinds.has("CURRENT_SUPPORTING_STATISTIC")).toBe(false);
  });

  it("rejects event-duration-only stories", () => {
    expect(hasSubstantiveStatistic(s("Two-day business conference opens in Accra", "Ghana hosts the event.")).code)
      .toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
    expect(hasSubstantiveStatistic(s("Three-day investment summit attracts businesses in Accra")).code)
      .toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
    expect(hasSubstantiveStatistic(s("Fair runs from 8am to 8pm in Accra")).code)
      .toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
    expect(hasSubstantiveStatistic(s("Accra church marks 40th anniversary")).code)
      .toBe("REJECT_NO_SUBSTANTIVE_NUMBER");
  });

  it("accepts figures that measure the claim", () => {
    expect(hasSubstantiveStatistic(s("Fair offers school supplies at 20% lower prices in Accra")).ok).toBe(true);
    expect(hasSubstantiveStatistic(s("Fair generated GHS 4.2 million in sales in Accra")).ok).toBe(true);
    expect(hasSubstantiveStatistic(s("4,000 families attended the Accra fair")).ok).toBe(true);
  });

  it("does not let a historical statistic qualify a current announcement", () => {
    const r = hasSubstantiveStatistic(s(
      "2026 Accra trade fair announced",
      "Organisers confirmed the fair. 77 exhibitors attended in 2018.",
    ));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("REJECT_NO_CURRENT_SUBSTANTIVE_NUMBER");
  });

  it("does not let economic vocabulary substitute for a figure", () => {
    expect(hasSubstantiveStatistic(s(
      "Families can buy goods at discounted prices in Accra",
      "The discount, cost, inflation and household expenditure pressures are severe.",
    )).ok).toBe(false);
  });
});
