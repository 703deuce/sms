/**
 * Stage 2 MCTB presentation guard — fails if prohibited legacy UI imports appear
 * in Opus MCTB customer-facing source trees.
 *
 * Target: MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: 0
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const SCAN_ROOTS = [
  "src/newui-transplant/components/mctb",
  "src/newui-transplant/connected/mctb",
  "src/newui-transplant/mirror/routes/mctb",
  "src/app/f/mctb",
  "src/lib/mctb/onboarding/mctb-onboarding-opus-view.tsx",
].map((p) => path.join(ROOT, p));

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx"]);

const PROHIBITED_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "@/components/mctb/", re: /from\s+["']@\/components\/mctb\// },
  { id: "@/components/ui/", re: /from\s+["']@\/components\/ui\// },
  { id: "kimi-conversations-connected", re: /kimi-conversations-connected/ },
  { id: "components/inbox/kimi", re: /from\s+["']@\/components\/inbox\/kimi/ },
];

/** Presentation utilities that do not render legacy UI (documented exceptions). */
const LINE_ALLOWLIST: RegExp[] = [
  /\/\/ mctb-stage2-legacy-import-allow:/,
];

function isStage2RollbackOnly(file: string): boolean {
  const base = path.basename(file);
  return base.includes("-legacy.") || base.includes(".legacy.");
}

function collectFiles(entry: string): string[] {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    if (isStage2RollbackOnly(entry)) return [];
    return ALLOWED_EXTENSIONS.has(path.extname(entry)) ? [entry] : [];
  }
  const out: string[] = [];
  for (const name of fs.readdirSync(entry)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const child = path.join(entry, name);
    if (isStage2RollbackOnly(child)) continue;
    out.push(...collectFiles(child));
  }
  return out;
}

type Violation = { file: string; line: number; rule: string; text: string };

function scanFile(file: string): Violation[] {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (LINE_ALLOWLIST.some((re) => re.test(line))) continue;
    for (const { id, re } of PROHIBITED_PATTERNS) {
      if (re.test(line)) {
        violations.push({ file: rel, line: i + 1, rule: id, text: line.trim() });
      }
    }
  }
  return violations;
}

function main() {
  const files = SCAN_ROOTS.flatMap(collectFiles);
  const violations = files.flatMap(scanFile);

  if (violations.length === 0) {
    console.log("MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: 0");
    console.log("PASS verify:mctb-stage2-legacy-imports");
    process.exit(0);
  }

  console.error(`MCTB_STAGE2_LEGACY_PRESENTATION_IMPORTS: ${violations.length}`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.text}`);
  }
  console.error("FAIL verify:mctb-stage2-legacy-imports");
  process.exit(1);
}

main();
