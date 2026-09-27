/**
 * Stage 2 MCTB presentation certification — four zero targets for PURE_OPUS.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

function runScript(name: string): number {
  const res = spawnSync("npx", ["tsx", path.join("scripts", name)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const match = out.match(/MCTB_[A-Z_]+:\s*(\d+)/);
  process.stdout.write(out);
  return match ? Number(match[1]) : res.status === 0 ? 0 : 999;
}

const LEGACY_CSS_PATTERNS = [
  /@\/components\/mctb\/shell\//,
  /components\/mctb\/shell\/.*\.css/,
  /components\/mctb\/onboarding\/mctb-onboarding-wizard\.css/,
  /components\/mctb\/kimi-ui\/reference\.css/,
];

const STAGE2_CSS_SCAN_FILES = [
  "src/app/(app)/mctb/layout.tsx",
  "src/components/layout/app-shell.tsx",
  "src/newui-transplant/connected/mctb",
  "src/newui-transplant/components/mctb",
  "src/newui-transplant/mirror/routes/mctb",
  "src/app/f/mctb",
  "src/lib/mctb/onboarding/mctb-onboarding-runtime.tsx",
];

const CSS_ALLOWLIST = new Set([
  "src/app/(app)/mctb/mctb-legacy-shell-styles.tsx",
  "src/components/layout/mctb-legacy-app-shell-styles.tsx",
  "src/lib/mctb/onboarding/mctb-onboarding-legacy-styles.ts",
]);

function walk(entry: string): string[] {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];
  const out: string[] = [];
  for (const name of fs.readdirSync(abs)) {
    if (name.startsWith(".")) continue;
    const child = path.join(abs, name);
    if (name.includes("-legacy.")) continue;
    out.push(...walk(path.relative(ROOT, child)));
  }
  return out;
}

function countLegacyCssLoaded(): number {
  let violations = 0;
  const files = STAGE2_CSS_SCAN_FILES.flatMap((p) => walk(p)).filter((f) => /\.(tsx|ts)$/.test(f));
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (CSS_ALLOWLIST.has(rel)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
      if (line.includes("import(") && line.includes("legacy")) continue;
      if (LEGACY_CSS_PATTERNS.some((re) => re.test(line))) {
        violations++;
        console.error(`  ${rel}: ${line.trim()}`);
      }
    }
  }
  return violations;
}

const MCTB_PAGE_GLOBS = [
  "src/app/(app)/mctb",
  "src/app/(app)/onboarding/mctb",
  "src/app/f/mctb",
];

function countLegacyComponentsRenderedRisk(): number {
  let violations = 0;
  const files = MCTB_PAGE_GLOBS.flatMap((p) => walk(p)).filter((f) => /page\.tsx$/.test(f));
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    const importsLegacy = /from\s+["']@\/components\/mctb\//.test(text);
    if (!importsLegacy) continue;
    if (!/isNewUiStage2Enabled/.test(text)) {
      violations++;
      console.error(`  ${rel}: legacy MCTB import without Stage 2 gate`);
      continue;
    }
    const stage2Block = text.match(/if\s*\(\s*isNewUiStage2Enabled\(\)\s*\)\s*\{[\s\S]*?\n\s*\}/);
    if (stage2Block && /@\/components\/mctb\//.test(stage2Block[0])) {
      violations++;
      console.error(`  ${rel}: legacy MCTB referenced inside Stage 2 ON branch`);
    }
  }
  return violations;
}

function main() {
  console.log("=== MCTB Stage 2 presentation certification ===\n");

  const legacyImports = runScript("verify-mctb-stage2-legacy-imports.ts");
  console.log("");

  const demoState = runScript("verify-mctb-stage2-demo-state.ts");
  console.log("");

  const legacyCss = countLegacyCssLoaded();
  console.log(`MCTB_STAGE2_LEGACY_CSS_LOADED: ${legacyCss}`);
  if (legacyCss > 0) console.error("FAIL legacy CSS in Stage 2 source tree");
  else console.log("PASS legacy CSS boundary");
  console.log("");

  const legacyComponents = countLegacyComponentsRenderedRisk();
  console.log(`MCTB_STAGE2_LEGACY_COMPONENTS_RENDERED: ${legacyComponents}`);
  if (legacyComponents > 0) console.error("FAIL legacy component render risk in Stage 2 routes");
  else console.log("PASS legacy component render boundary");
  console.log("");

  const pure =
    legacyImports === 0 &&
    demoState === 0 &&
    legacyCss === 0 &&
    legacyComponents === 0;

  console.log(pure ? "MCTB_STAGE2_FRONTEND: PURE_OPUS" : "MCTB_STAGE2_FRONTEND: MIXED");
  process.exit(pure ? 0 : 1);
}

main();
