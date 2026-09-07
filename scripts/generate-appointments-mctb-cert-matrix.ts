/**
 * Generate authoritative certification matrix from inventory + cert-matrix-definitions.
 *
 * Run: npx tsx scripts/generate-appointments-mctb-cert-matrix.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CERT_MATRIX_CASES, type CertCase } from "./lib/cert-matrix-definitions";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const MATRIX_MD = join(CERT_DIR, "APPOINTMENTS-MCTB-CERTIFICATION-MATRIX.md");
const MATRIX_JSON = join(CERT_DIR, "appointments-mctb-certification-matrix.json");
const INVENTORY = join(ROOT, "docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md");

function mdRow(c: CertCase): string {
  const status = c.initialStatus ?? (c.execution === "UI" ? "UI DEFERRED" : "PENDING");
  return `| ${c.id} | ${c.product} | ${c.feature} | ${c.userSequence.slice(0, 80)}… | ${c.ui} | ${c.api} | ${c.db} | ${c.runtime} | ${c.errorPath} | ${status} |`;
}

function main() {
  if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });

  const inventoryStat = existsSync(INVENTORY)
    ? readFileSync(INVENTORY, "utf8").match(/Generated:\*\* (.+)/)?.[1] ?? "unknown"
    : "missing";

  const byProduct = {
    appointments: CERT_MATRIX_CASES.filter((c) => c.product === "appointments").length,
    mctb: CERT_MATRIX_CASES.filter((c) => c.product === "mctb").length,
    shared: CERT_MATRIX_CASES.filter((c) => c.product === "shared").length,
    cross: CERT_MATRIX_CASES.filter((c) => c.product === "cross").length,
  };

  const defects = CERT_MATRIX_CASES.filter(
    (c) => c.execution === "DEFECT" || c.initialStatus?.startsWith("DEFECT"),
  );

  const md = `# Appointments + MCTB — Source-Driven Certification Matrix

**Authority:** \`docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md\` (${inventoryStat})  
**Generated:** ${new Date().toISOString().slice(0, 10)}  
**Machine-readable:** \`docs/certification/appointments-mctb-certification-matrix.json\`  
**Staged runner:** \`npm run cert:appointments-mctb-staged\`

## Rules (binding)

1. This matrix is generated from the **2026-09-07 inventory** — not from legacy manual checklists.
2. **Excluded from certification:** login/auth flows, subscription purchase, real payment charges, real PSTN calls.
3. Payment **configuration** may be statically validated; do not charge cards.
4. Features requiring real phone calls → \`BLOCKED — PSTN\`.
5. No feature is covered because a page loads — must map UI → API → DB → runtime → error path.
6. Product is **not fully certified** while any statically testable FAIL / DEFECT remains.

### Status vocabulary

| Status | Meaning |
|--------|---------|
| PASS | Automated or documented proof complete |
| FAIL | Test failed — fix required |
| BLOCKED — PSTN | Requires real phone call |
| BLOCKED — LIVE EXTERNAL PROVIDER | Zoom/Teams bot, live OAuth, TFV approval, etc. |
| BLOCKED — ENVIRONMENT | Missing credentials/fixtures |
| NOT APPLICABLE | Out of scope |
| DEFECT — MISSING UI | Runtime/config exists without canonical UI |
| DEFECT — MISSING RUNTIME | UI control with no consumer |
| UI DEFERRED | Browser certification (separate pass) |
| TIMEOUT | Batch exceeded hard timeout |

## Summary

| Product | Cases |
|---------|-------|
| Appointments | ${byProduct.appointments} |
| MCTB | ${byProduct.mctb} |
| Shared / flags | ${byProduct.shared} |
| Cross-product | ${byProduct.cross} |
| **Total** | **${CERT_MATRIX_CASES.length}** |

## Known defects (must resolve or retire)

${defects.length ? defects.map((d) => `- **${d.id}:** ${d.feature} — ${d.notes ?? d.ui}`).join("\n") : "_None_"}

### MCTB legacy schedule note

- \`MCTB-LEGACY-SCHED-001\`: Legacy \`businessHoursOnly\` / schedule fields in DB must remain backward compatible.
- Retired **Business Hours** UI must **not** reappear as canonical MCTB nav.

---

## Master matrix

| ID | Product | Feature | User sequence | UI | API | DB | Runtime | Error path | Status |
|----|---------|---------|---------------|----|----|----|---------|------------|--------|
${CERT_MATRIX_CASES.map(mdRow).join("\n")}

---

## Execution

\`\`\`bash
npm run cert:appointments-mctb-staged          # full pipeline
npm run cert:appointments-mctb-staged -- --list
npm run cert:appointments-mctb-staged -- --from 3 --continue-on-fail
\`\`\`

Results: \`docs/certification/APPOINTMENTS_MCTB_CERTIFICATION_RESULTS.md\`  
State: \`docs/certification/appointments-mctb-certification-state.json\`
`;

  writeFileSync(MATRIX_MD, md);
  writeFileSync(
    MATRIX_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        authority: "docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md",
        totalCases: CERT_MATRIX_CASES.length,
        byProduct,
        defects: defects.map((d) => ({ id: d.id, feature: d.feature, notes: d.notes })),
        cases: CERT_MATRIX_CASES,
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${MATRIX_MD}`);
  console.log(`Wrote ${MATRIX_JSON}`);
  console.log(`Total certification cases: ${CERT_MATRIX_CASES.length}`);
}

main();
