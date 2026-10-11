/**
 * Repair AR completion matrix: ensure Evidence column, apply integrity overrides, refresh summary.
 * Run: node scripts/apply-ar-matrix-integrity.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROW_OVERRIDES, defaultEvidence } from "./ar-matrix-row-overrides.mjs";

const matrixPath = join(process.cwd(), "docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md");
let text = readFileSync(matrixPath, "utf8");

const lineRe =
  /^(\| (AR-WS[\d-]+) \|)(.+?)( \| (complete|partial|missing|excluded) \| ([^|]+) \| ([^|]+))(?: \| ([^|]*))?( \|)$/;

const rows = [];
const lines = text.split("\n");
const outLines = [];

for (const line of lines) {
  const m = line.match(lineRe);
  if (!m) {
    outLines.push(line);
    continue;
  }
  const id = m[2].trim();
  const middle = m[3]; // req | audit | code paths
  let impl = m[5].trim();
  let auto = m[6].trim();
  let prod = m[7].trim();
  let evidence = (m[8] || "").trim();

  const parts = middle.split(" | ").map((s) => s.trim());
  if (parts.length < 3) {
    outLines.push(line);
    continue;
  }
  const req = parts[0];
  const audit = parts[1];
  const code = parts.slice(2).join(" | ");

  const ov = ROW_OVERRIDES[id] || {};
  if (ov.impl) impl = ov.impl;
  if (ov.auto) auto = ov.auto;
  if (ov.prod) prod = ov.prod;
  if (ov.evidence) evidence = ov.evidence;
  else if (!evidence) evidence = defaultEvidence(id, code, impl);

  evidence = evidence.replace(/\|/g, "\\|");

  const rebuilt = `| ${id} | ${req} | ${audit} | ${code} | ${impl} | ${auto} | ${prod} | ${evidence} |`;
  outLines.push(rebuilt);
  rows.push({ id, impl, auto, prod });
}

text = outLines.join("\n");

const implCounts = { complete: 0, partial: 0, missing: 0, excluded: 0 };
for (const r of rows) implCounts[r.impl] = (implCounts[r.impl] || 0) + 1;

const applicable = rows.filter((r) => r.impl !== "excluded").length;
const autoPass = rows.filter((r) => r.auto === "pass").length;
const autoFail = rows.filter((r) => r.auto === "fail").length;
const prodPass = rows.filter((r) => r.prod === "pass").length;
const prodNotRun = rows.filter((r) => r.prod === "not_run").length;
const prodNa = rows.filter((r) => r.prod === "n/a").length;

const summaryBlock = `| Metric | Count |
|--------|------:|
| Workstream requirement rows | ${rows.length} |
| Policy exclusions (AR-X table, not implementable rows) | 5 |
| Excluded within workstreams (in-table) | ${implCounts.excluded} |
| Applicable implementable rows | ${applicable} |
| Implementation **complete** | ${implCounts.complete} |
| Implementation **partial** | ${implCounts.partial} |
| Implementation **missing** | ${implCounts.missing} |
| Automated verification **pass** | ${autoPass} |
| Automated verification **fail** | ${autoFail} |
| Production verification **pass** | ${prodPass} |
| Production verification **not_run** | ${prodNotRun} |
| Production verification **n/a** | ${prodNa} |

**Completion pass status:** **NOT FINISHED** — ${implCounts.partial} partial and ${implCounts.missing} missing among ${applicable} applicable rows. Summary derived from row-level Impl / Auto / Prod. Automated tests do not certify live Telnyx, Stripe, Brevo, Luna, or Microsoft Graph. See \`docs/AR-FULL-FUNCTIONAL-COMPLETION-INTEGRITY-AUDIT-2026-10-11.md\`.`;

text = text.replace(
  /\| Metric \| Count \|[\s\S]*?See `docs\/AR-FULL-FUNCTIONAL-COMPLETION-INTEGRITY-AUDIT-2026-10-11\.md`\./,
  summaryBlock,
);

text = text.replace(
  /\| 2026-10-11 \| All applicable rows \| Graph extended phone[\s\S]*?matrix \*\*FINISHED\*\* \|/,
  `| 2026-10-11 | Integrity audit | Row-level Impl/Auto/Prod + evidence column; summary **NOT FINISHED**; partial rows documented |`,
);

text = text.replace(
  /Inventory authority: `docs\/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX\.md` \(\*\*FINISHED\*\* on branch/,
  "Inventory authority: `docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md` (**NOT FINISHED** — see integrity audit on branch",
);

writeFileSync(matrixPath, text);
console.log(
  JSON.stringify(
    { rows: rows.length, applicable, ...implCounts, autoPass, prodPass, prodNotRun },
    null,
    2,
  ),
);
