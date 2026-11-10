import assert from "node:assert/strict";
import test from "node:test";
import {
  accraDateKey,
  accraDayBounds,
  accraParts,
  accumulatePublicationDays,
  formatLongDate,
  groupDaysByYear,
  isRealCalendarDate,
  monthGrid,
  parseDayRoute,
} from "./archiveDates";

test("Accra midnight bounds are UTC midnights", () => {
  const { start, end } = accraDayBounds(2026, 1, 1);
  assert.equal(start, "2026-01-01T00:00:00.000Z");
  assert.equal(end, "2026-01-02T00:00:00.000Z");
});

test("an instant just before Accra midnight stays on the previous day", () => {
  assert.equal(accraDateKey("2026-01-01T00:00:00.000Z"), "2026-01-01");
  assert.deepEqual(accraParts("2025-12-31T23:59:59.000Z"), { year: 2025, month: 12, day: 31 });
});

test("long dates use the day-month-year form", () => {
  assert.equal(formatLongDate(2026, 1, 1), "1 January 2026");
  assert.equal(formatLongDate(2026, 11), "November 2026");
});

test("invalid calendar days are rejected", () => {
  assert.equal(parseDayRoute("2026", "02", "31"), null);
  assert.equal(isRealCalendarDate(2024, 2, 29), true);
  assert.equal(parseDayRoute("1999", "01", "01"), null);
});

test("counts group by Accra day and then by month", () => {
  const days = accumulatePublicationDays([
    { published_at: "2026-11-10T16:12:59.024Z" },
    { published_at: "2026-11-10T01:00:00.000Z" },
    { published_at: "2026-10-31T23:00:00.000Z" },
    { published_at: null },
  ]);
  assert.equal(days[0].publishedOn, "2026-11-10");
  assert.equal(days[0].count, 2);
  assert.equal(days[1].publishedOn, "2026-10-31");
  const years = groupDaysByYear(days);
  assert.equal(years.length, 1);
  assert.equal(years[0].count, 3);
  assert.deepEqual(years[0].months.map((m) => m.month), [11, 10]);
});

test("November 2026 starts on a Sunday, so the Monday-first grid has six blanks", () => {
  const cells = monthGrid(2026, 11);
  assert.equal(cells.slice(0, 6).every((c) => c === null), true);
  assert.deepEqual(cells[6], { day: 1 });
  assert.equal(cells.filter((c) => c?.day).length, 30);
});
