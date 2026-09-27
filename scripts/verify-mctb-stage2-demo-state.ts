/**
 * Stage 2 MCTB — customer-visible demo/sandbox wiring guard.
 *
 * Connected production shells must not import sandbox fixtures.
 * Target: MCTB_CUSTOMER_VISIBLE_DEMO_STATE: 0
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const CONNECTED_MCTB = path.join(ROOT, "src/newui-transplant/connected/mctb");
const PUBLIC_MCTB = path.join(ROOT, "src/app/f/mctb");

const FORBIDDEN_IN_CONNECTED = [
  { id: "sandbox-data import", re: /from\s+["']@\/newui-transplant\/lib\/sandbox-data["']/ },
  { id: "legacy mctb import", re: /from\s+["']@\/components\/mctb\// },
  { id: "root ui import", re: /from\s+["']@\/components\/ui\// },
];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(name) && !name.includes("-legacy.")) out.push(full);
  }
  return out;
}

function main() {
  const files = [...walk(CONNECTED_MCTB), ...walk(PUBLIC_MCTB)];
  const violations: Array<{ file: string; line: number; rule: string; text: string }> = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of FORBIDDEN_IN_CONNECTED) {
        if (rule.re.test(line)) {
          violations.push({ file: rel, line: i + 1, rule: rule.id, text: line.trim() });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("MCTB_CUSTOMER_VISIBLE_DEMO_STATE: 0");
    console.log("PASS verify:mctb-stage2-demo-state");
    process.exit(0);
  }

  console.error(`MCTB_CUSTOMER_VISIBLE_DEMO_STATE: ${violations.length}`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.text}`);
  }
  console.error("FAIL verify:mctb-stage2-demo-state");
  process.exit(1);
}

main();
