import assert from "node:assert/strict";
import {
  chartAxisLabelIndices,
  formatChartAxisDate,
  missedCallsDateFromAnalyticsRange,
} from "../src/lib/mctb/analytics-range";
import { formatSuppressionReasonLabel } from "../src/lib/mctb/analytics-suppression-labels";

assert.equal(missedCallsDateFromAnalyticsRange("7d"), "7d");
assert.equal(missedCallsDateFromAnalyticsRange("90d"), "all");

const labels30 = chartAxisLabelIndices(30, "30d");
assert.ok(labels30.length >= 4);
assert.equal(labels30[0], 0);

const d = formatChartAxisDate("2026-08-28", "30d");
assert.ok(d.includes("28"));

assert.equal(formatSuppressionReasonLabel("cooldown_cleared_for_cert"), "Cooldown cleared");

console.log("test-mctb-analytics-range: ok");
