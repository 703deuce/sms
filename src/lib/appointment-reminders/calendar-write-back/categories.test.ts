import assert from "node:assert/strict";
import {
  mergeTransovoOutlookCategories,
  transovoCategoryForWriteBackKind,
} from "./categories";

const merged = mergeTransovoOutlookCategories(
  ["Customer VIP", "Transovo: Pending"],
  "confirmed",
  true,
);
assert.ok(merged.includes("Customer VIP"));
assert.ok(merged.includes("Transovo: Confirmed"));
assert.ok(!merged.includes("Transovo: Pending"));

const noColor = mergeTransovoOutlookCategories(["A"], "canceled", false);
assert.deepEqual(noColor, ["A"]);

assert.equal(
  transovoCategoryForWriteBackKind("reschedule_requested"),
  "Transovo: Reschedule requested",
);

console.log("calendar-write-back categories.test.ts: PASS");
