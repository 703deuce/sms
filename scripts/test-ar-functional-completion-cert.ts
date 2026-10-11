/**
 * Integrity checks for AR full functional completion matrix.
 * Does NOT assert 100% implementation complete or FINISHED status.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();

const requiredPaths = [
  "docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md",
  "docs/AR-FULL-FUNCTIONAL-COMPLETION-INTEGRITY-AUDIT-2026-10-11.md",
  "src/lib/calendar/eligibility.ts",
  "src/lib/calendar/import-rules.ts",
  "src/lib/appointment-reminders/ar-operational-pause.ts",
  "src/lib/appointment-reminders/ar-recipient-suppression.ts",
  "src/lib/appointment-reminders/ar-staff-delivery-alert.ts",
  "src/app/api/appointment-reminders/setup/configure-complete/route.ts",
  "src/app/api/appointment-reminders/export/reminders/route.ts",
  "src/app/api/appointment-reminders/export/responses/route.ts",
  "src/app/api/appointment-reminders/appointments/[id]/reminder-suppress/route.ts",
];

for (const rel of requiredPaths) {
  assert.ok(existsSync(join(root, rel)), `missing required path: ${rel}`);
}

const matrix = readFileSync(join(root, "docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md"), "utf8");

assert.match(matrix, /Completion pass status:\*\* \*\*NOT FINISHED\*\*/);
assert.doesNotMatch(matrix, /Completion pass status:\*\* \*\*FINISHED\*\*/);

const rowRe =
  /^\| (AR-WS[\d-]+) \| [^|]+ \| [^|]+ \| [^|]+ \| (complete|partial|missing|excluded) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/;

const rows: { id: string; impl: string; auto: string; prod: string; evidence: string }[] = [];
for (const line of matrix.split("\n")) {
  const m = line.match(rowRe);
  if (m) {
    rows.push({
      id: m[1],
      impl: m[2],
      auto: m[3].trim(),
      prod: m[4].trim(),
      evidence: m[5].trim(),
    });
  }
}

assert.equal(rows.length, 90, "expected 90 workstream rows with Evidence column");

const stale =
  /\b(needs dedicated|optional gate not enforced|TBD merge|pending manual execution|Manual prod execution|Process doc update pending|not enforced)\b/i;
const badComplete = rows.filter((r) => r.impl === "complete" && stale.test(r.evidence));
assert.equal(
  badComplete.length,
  0,
  `complete rows with stale evidence phrases: ${badComplete.map((r) => r.id).join(", ")}`,
);

const implCounts = { complete: 0, partial: 0, missing: 0, excluded: 0 };
for (const r of rows) implCounts[r.impl as keyof typeof implCounts]++;

const applicable = rows.filter((r) => r.impl !== "excluded").length;
const summaryPartial = matrix.match(/\| Implementation \*\*partial\*\* \| (\d+) \|/);
const summaryComplete = matrix.match(/\| Implementation \*\*complete\*\* \| (\d+) \|/);
const summaryApplicable = matrix.match(/\| Applicable implementable rows \| (\d+) \|/);
const summaryExcluded = matrix.match(/\| Excluded within workstreams \(in-table\) \| (\d+) \|/);

assert.ok(summaryPartial && summaryComplete && summaryApplicable && summaryExcluded);
assert.equal(Number(summaryApplicable[1]), applicable);
assert.equal(Number(summaryExcluded[1]), implCounts.excluded);
assert.equal(Number(summaryComplete[1]), implCounts.complete);
assert.equal(Number(summaryPartial[1]), implCounts.partial);

const partialIds = rows.filter((r) => r.impl === "partial").map((r) => r.id).sort();
assert.ok(partialIds.length > 0, "integrity pass expects documented partial rows");

execSync("node scripts/reconcile-ar-completion-matrix.mjs --check", {
  cwd: root,
  stdio: "pipe",
});

console.log("test-ar-functional-completion-cert.ts integrity checks PASS");
console.log(`partial (${partialIds.length}): ${partialIds.join(", ")}`);
