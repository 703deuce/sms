import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO_ROOT } from "./config";
import { log } from "./logger";
import { normalizeRepoRelativePath } from "./path-guards";
import type { ImplementationPlan, ProposedFileChange } from "./types";

export function applyAcceptedChanges(
  changes: ProposedFileChange[],
  dryRun: boolean,
): string[] {
  const touched: string[] = [];

  for (const change of changes) {
    const rel = normalizeRepoRelativePath(change.file);
    const abs = join(REPO_ROOT, rel);
    log(dryRun ? "would apply" : "applying change", `${change.action} ${rel}`);

    if (dryRun) {
      touched.push(rel);
      continue;
    }

    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, change.content, "utf8");
    touched.push(rel);
  }

  return touched;
}

export function summarizeImplementationPlan(plan: ImplementationPlan): string {
  return `${plan.changes.length} file(s) proposed — ${plan.summary}`;
}
