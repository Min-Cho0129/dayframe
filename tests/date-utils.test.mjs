import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLocalDate,
  getLocalDateKey,
  getMillisecondsUntilNextLocalDay,
} from "../app/date-utils.js";

const originalTimeZone = process.env.TZ;
process.env.TZ = "America/Chicago";

test.after(() => {
  if (originalTimeZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTimeZone;
  }
});

test("uses the browser local date instead of the UTC date", () => {
  const chicagoEvening = new Date("2026-07-22T02:30:00.000Z");

  assert.equal(getLocalDateKey(chicagoEvening), "2026-07-21");
  assert.equal(formatLocalDate(chicagoEvening), "Tuesday, July 21");
});

test("rolls over at local midnight", () => {
  const beforeMidnight = new Date("2026-07-22T04:59:00.000Z");
  const afterMidnight = new Date("2026-07-22T05:00:00.000Z");

  assert.equal(getLocalDateKey(beforeMidnight), "2026-07-21");
  assert.equal(getLocalDateKey(afterMidnight), "2026-07-22");
});

test("handles daylight saving time days with local calendar dates", () => {
  const dstStart = new Date("2026-03-08T08:30:00.000Z");
  const dstEnd = new Date("2026-11-01T07:30:00.000Z");

  assert.equal(getLocalDateKey(dstStart), "2026-03-08");
  assert.equal(getLocalDateKey(dstEnd), "2026-11-01");
});

test("computes the next local-day refresh delay", () => {
  const almostMidnight = new Date("2026-07-22T04:59:30.000Z");

  assert.equal(getMillisecondsUntilNextLocalDay(almostMidnight), 30_000);
});
