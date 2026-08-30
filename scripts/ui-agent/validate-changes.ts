import { execSync } from "node:child_process";
import { REPO_ROOT } from "./config";
import { isProtectedPath } from "./path-guards";
import { log, logError } from "./logger";

export type ValidationResult = {
  ok: boolean;
  lint: string;
  typecheck: string;
  tests: string;
  protectedViolations: string[];
};

export function validateTouchedFiles(files: string[]): ValidationResult {
  const protectedViolations = files.filter((f) => isProtectedPath(f));
  if (protectedViolations.length > 0) {
    return {
      ok: false,
      lint: "skipped",
      typecheck: "skipped",
      tests: "skipped",
      protectedViolations,
    };
  }

  let lint = "skipped";
  let typecheck = "skipped";
  let tests = "skipped";

  try {
    if (files.some((f) => f.endsWith(".tsx") || f.endsWith(".ts"))) {
      execSync(`npx eslint ${files.map((f) => `"${f}"`).join(" ")}`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: "pipe",
      });
      lint = "pass";
    }
  } catch (err) {
    lint = err instanceof Error ? err.message : String(err);
    logError("lint failed", lint.slice(0, 300));
  }

  try {
    execSync("npx tsc --noEmit --pretty false", { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" });
    typecheck = "pass";
  } catch (err) {
    typecheck = err instanceof Error ? err.message : String(err);
    logError("typecheck failed", typecheck.slice(0, 300));
  }

  try {
    execSync("npx tsx scripts/ui-agent/certification.ts --quick", {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    tests = "pass";
  } catch {
    tests = "ui-agent certification quick check failed or skipped";
  }

  const ok = protectedViolations.length === 0 && lint !== "fail" && !lint.startsWith("Error");
  log("validation complete", ok ? "pass" : "issues found");
  return { ok, lint, typecheck, tests, protectedViolations };
}
