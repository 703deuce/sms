import assert from "node:assert/strict";
import { missedCallActionableIssue } from "../src/lib/mctb/missed-calls-display";
import { missedCallsSummaryRangeLabel } from "../src/lib/mctb/missed-calls-list-filters";

assert.equal(missedCallsSummaryRangeLabel("30d"), "Last 30 days");
assert.equal(missedCallActionableIssue("FAILED", null).show, true);
assert.equal(missedCallActionableIssue("SUPPRESSED", "TRIGGER_DISABLED").show, false);
assert.equal(missedCallActionableIssue("SUPPRESSED", "NOT_EXISTING_CONSENT").show, true);

console.log("test-missed-calls-display: ok");
