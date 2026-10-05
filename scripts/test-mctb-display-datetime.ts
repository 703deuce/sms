import assert from "node:assert/strict";
import {
  formatMctbChartWeekdayLabel,
  formatMctbCompactDateTime,
  formatMctbFriendlyDateTime,
  normalizeMctbDisplayTimeZone,
} from "../src/lib/mctb/display-datetime";

const tz = "America/New_York";
const instant = "2026-08-02T20:30:00.000Z";

assert.equal(normalizeMctbDisplayTimeZone("America/Chicago"), "America/Chicago");
assert.equal(normalizeMctbDisplayTimeZone("bogus"), "America/New_York");

const friendly = formatMctbFriendlyDateTime(instant, tz);
assert.match(friendly, /August 2nd, 2026 at /);
assert.match(friendly, /PM|AM/);
assert.ok(!friendly.includes("UTC"));
assert.ok(!friendly.includes("Z"));

const compact = formatMctbCompactDateTime(instant, tz);
assert.match(compact, /Aug 2/);
assert.ok(!compact.includes("UTC"));

const weekday = formatMctbChartWeekdayLabel("2026-08-02", tz);
assert.equal(weekday, "Sun");

console.log("test-mctb-display-datetime: PASS");
