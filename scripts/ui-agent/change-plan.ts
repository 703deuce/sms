import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_REPORTS_DIR } from "./config";
import { assertAllowedChangePath, normalizeRepoRelativePath } from "./path-guards";
import type { DifferencePlan, ImplementationPlan, ProposedFileChange } from "./types";

export function validateImplementationPlan(plan: ImplementationPlan): {
  accepted: ProposedFileChange[];
  rejected: Array<{ file: string; reason: string }>;
} {
  const accepted: ProposedFileChange[] = [];
  const rejected: Array<{ file: string; reason: string }> = [];

  for (const change of plan.changes) {
    try {
      const rel = normalizeRepoRelativePath(change.file);
      assertAllowedChangePath(rel);
      if (!change.content?.trim()) {
        rejected.push({ file: change.file, reason: "Empty content" });
        continue;
      }
      accepted.push({ ...change, file: rel });
    } catch (err) {
      rejected.push({
        file: change.file,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { accepted, rejected };
}

export function writePlanReport(input: {
  sessionId: string;
  target: string;
  referenceFiles: string[];
  inspectedFiles: string[];
  differencePlan: DifferencePlan;
  implementationPlan?: ImplementationPlan;
  rejectedChanges?: Array<{ file: string; reason: string }>;
}): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(UI_AGENT_REPORTS_DIR, `${timestamp}-plan.md`);
  const lines: string[] = [
    `# UI Agent Plan — ${input.target}`,
    "",
    `Session: ${input.sessionId}`,
    "",
    "## Reference files",
    ...input.referenceFiles.map((f) => `- ${f}`),
    "",
    "## Files inspected",
    ...input.inspectedFiles.map((f) => `- ${f}`),
    "",
    "## Difference plan",
    "```json",
    JSON.stringify(input.differencePlan, null, 2),
    "```",
  ];

  if (input.implementationPlan) {
    lines.push("", "## Implementation plan", "```json", JSON.stringify(input.implementationPlan, null, 2), "```");
  }

  if (input.rejectedChanges?.length) {
    lines.push("", "## Rejected changes", ...input.rejectedChanges.map((r) => `- ${r.file}: ${r.reason}`));
  }

  if (input.differencePlan.backendChangesRequired?.length) {
    lines.push("", "## Backend gaps (not implemented by UI agent)");
    for (const gap of input.differencePlan.backendChangesRequired) {
      lines.push(`- **${gap.feature}**: ${gap.reason}`);
    }
  }

  writeFileSync(reportPath, lines.join("\n"), "utf8");
  writeFileSync(join(UI_AGENT_REPORTS_DIR, "latest.md"), lines.join("\n"), "utf8");
  return reportPath;
}
