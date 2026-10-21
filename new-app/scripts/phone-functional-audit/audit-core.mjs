import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function createAuditReport(reportPath) {
  const results = [];

  function record(testId, feature, executed, expected, actual, status, evidence = "", filesChanged = "") {
    results.push({
      testId,
      feature,
      executed,
      expected,
      actual,
      status,
      evidence: String(evidence).slice(0, 4000),
      filesChanged,
    });
  }

  function writeReport(meta = {}) {
    const summary = {
      generatedAt: new Date().toISOString(),
      mode: meta.mode || "full",
      baseUrl: meta.baseUrl || null,
      databaseUrlAvailable: Boolean(meta.databaseUrlAvailable),
      totals: {
        PASS: results.filter((r) => r.status === "PASS").length,
        FAIL: results.filter((r) => r.status === "FAIL").length,
        BLOCKED: results.filter((r) => r.status === "BLOCKED").length,
        NOT_IMPLEMENTED: results.filter((r) => r.status === "NOT_IMPLEMENTED").length,
      },
      results,
      readiness: meta.readiness || {},
      liveManualChecklistPath: "new-app/docs/PHONE-LIVE-MANUAL-TEST-CHECKLIST.md",
    };

    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(summary, null, 2));

    const mdPath = reportPath.replace(/\.json$/, ".md");
    const lines = [
      "# Transovo Phone — Full automated functional audit",
      "",
      `Generated: ${summary.generatedAt}`,
      `Mode: ${summary.mode}`,
      `API base: ${summary.baseUrl || "(none)"}`,
      `DATABASE_URL in runner: ${summary.databaseUrlAvailable}`,
      "",
      "| Status | Count |",
      "|--------|-------|",
      `| PASS | ${summary.totals.PASS} |`,
      `| FAIL | ${summary.totals.FAIL} |`,
      `| BLOCKED | ${summary.totals.BLOCKED} |`,
      `| NOT_IMPLEMENTED | ${summary.totals.NOT_IMPLEMENTED} |`,
      "",
    ];
    if (Object.keys(summary.readiness).length) {
      lines.push("## Readiness summary", "");
      for (const [area, verdict] of Object.entries(summary.readiness)) {
        lines.push(`- **${area}**: ${verdict}`);
      }
      lines.push("");
    }
    lines.push("## Results", "");
    for (const r of results) {
      lines.push(`### ${r.testId} — ${r.feature} — **${r.status}**`);
      lines.push(`- Executed: ${r.executed}`);
      lines.push(`- Expected: ${r.expected}`);
      lines.push(`- Actual: ${r.actual}`);
      if (r.evidence) lines.push(`- Evidence: \`${r.evidence.replace(/`/g, "'").slice(0, 500)}\``);
      lines.push("");
    }
    writeFileSync(mdPath, lines.join("\n"));
    return { summary, mdPath };
  }

  return { results, record, writeReport };
}
