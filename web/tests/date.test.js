import assert from "node:assert/strict";
import test from "node:test";
import { daysSinceDate, todayInSriLanka } from "../src/lib/date.js";

test("reports the exact age of the last verified Pettah quote", () => {
  assert.equal(daysSinceDate("2026-05-06", "2026-11-02"), 180);
});

test("returns null for unavailable or malformed dates", () => {
  assert.equal(daysSinceDate(null, "2026-11-02"), null);
  assert.equal(daysSinceDate("not-a-date", "2026-11-02"), null);
});

test("uses Sri Lanka local date near UTC midnight", () => {
  assert.equal(todayInSriLanka(new Date("2026-11-02T18:32:00.000Z")), "2026-11-03");
});
