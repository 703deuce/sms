/**
 * Reconcile AR completion matrix summary from row-level Impl / Auto / Prod columns.
 * Run: node scripts/reconcile-ar-completion-matrix.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const matrixPath = join(process.cwd(), "docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md");
let text = readFileSync(matrixPath, "utf8");

const rowRe =
  /^\| (AR-WS[\d-]+) \| [^|]+ \| [^|]+ \| [^|]+ \| (complete|partial|missing|excluded) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/;

const rows = [];
for (const line of text.split("\n")) {
  const m = line.match(rowRe);
  if (m) {
    rows.push({
      id: m[1].trim(),
      impl: m[2].trim(),
      auto: m[3].trim(),
      prod: m[4].trim(),
      evidence: m[5].trim(),
    });
  }
}

const implCounts = { complete: 0, partial: 0, missing: 0, excluded: 0 };
for (const r of rows) implCounts[r.impl] = (implCounts[r.impl] || 0) + 1;

const applicable = rows.filter((r) => r.impl !== "excluded").length;
const autoPass = rows.filter((r) => r.auto === "pass").length;
const prodNotRun = rows.filter((r) => r.prod === "not_run").length;
const prodPass = rows.filter((r) => r.prod === "pass").length;

const summary = {
  workstreamRows: rows.length,
  excludedInWorkstreams: implCounts.excluded,
  applicableImplementable: applicable,
  complete: implCounts.complete,
  partial: implCounts.partial,
  missing: implCounts.missing,
  autoPass,
  prodPass,
  prodNotRun,
};

if (process.argv.includes("--check")) {
  const badComplete = [];
  const stale =
    /\b(needs dedicated|optional gate not enforced|TBD merge|pending manual execution|Manual prod execution|Process doc update pending|not enforced)\b/i;
  for (const line of text.split("\n")) {
    const m = line.match(rowRe);
    if (m && m[2] === "complete" && stale.test(m[5])) {
      badComplete.push(m[1].trim());
    }
  }
  if (badComplete.length) {
    console.error("FAIL: complete rows with stale/contradictory evidence:", badComplete.join(", "));
    process.exit(1);
  }
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

console.log("Summary from matrix rows:", JSON.stringify(summary, null, 2));
