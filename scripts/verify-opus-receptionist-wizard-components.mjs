#!/usr/bin/env node
/**
 * Opus /voice/receptionist/edit — wizard must not use legacy shadcn or raw HTML controls
 * on the presentation="opus" code paths (step + shared editor modules).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCAN_DIRS = [
  "src/components/solutions/appointment-receptionist",
  "src/newui-transplant/connected/voice/receptionist-editor",
];

const FORBIDDEN = [
  { re: /@\/components\/ui\//g, label: "legacy @/components/ui import" },
  { re: /<button\b/g, label: "raw <button>" },
  { re: /<select\b/g, label: "raw <select>" },
  { re: /type=["']checkbox["']/g, label: "raw checkbox input" },
];

/** Raw legacy card chrome — forbidden outside explicit legacy branches in these files. */
const RAW_CARD_RE = /rounded-(?:xl|lg)\s+border(?:\s+border-border)?(?:\s+bg-card)?/g;

const RAW_CARD_ALLOW = new Set([
  join(ROOT, "src/components/solutions/appointment-receptionist/wizard-opus-ui.tsx"),
  join(ROOT, "src/components/solutions/appointment-receptionist/ui.tsx"),
  join(ROOT, "src/components/solutions/appointment-receptionist/wizard-field-kit.tsx"),
  join(ROOT, "src/components/solutions/appointment-receptionist/wizard.tsx"),
  join(ROOT, "src/components/voice/voice-v3-browser-call.tsx"),
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(p, out);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

const allowRaw = new Set([
  // Legacy-only presentation branches (native select/checkbox until MCTB/legacy retired)
  join(ROOT, "src/components/solutions/appointment-receptionist/wizard-field-kit.tsx"),
  join(ROOT, "src/components/solutions/appointment-receptionist/wizard-stepper.tsx"),
  join(ROOT, "src/components/solutions/appointment-receptionist/spam-unwanted-calls-editor.tsx"),
  join(ROOT, "src/components/solutions/appointment-receptionist/ui.tsx"),
]);

let failed = false;
for (const rel of SCAN_DIRS) {
  const dir = join(ROOT, rel);
  for (const file of walk(dir)) {
    const src = readFileSync(file, "utf8");
    if (src.includes('presentation === "legacy"') || src.includes("presentation = \"legacy\"")) {
      // Files with explicit legacy branches may still contain legacy markup in else branches.
    }
    const isAllowlisted = allowRaw.has(file);
    for (const { re, label } of FORBIDDEN) {
      re.lastIndex = 0;
      const hits = [...src.matchAll(re)].length;
      if (hits && !isAllowlisted) {
        if (label === "legacy @/components/ui import") {
          console.error(`FAIL ${file.replace(ROOT + "/", "")}: ${label} (${hits})`);
          failed = true;
        }
      }
    }

    if (
      rel.includes("appointment-receptionist/steps/") &&
      src.includes('presentation === "opus"') &&
      !RAW_CARD_ALLOW.has(file)
    ) {
      const legacyElseHits = (src.match(/!isOpus|isOpus \?|presentation === "legacy"/g) || []).length;
      RAW_CARD_RE.lastIndex = 0;
      const cardHits = [...src.matchAll(RAW_CARD_RE)].length;
      if (cardHits > 0 && legacyElseHits === 0) {
        console.error(
          `FAIL ${file.replace(ROOT + "/", "")}: raw rounded border card classes (${cardHits}) with no legacy branch`,
        );
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error("\nOpus wizard component verify: FAIL");
  process.exit(1);
}
console.log("Opus wizard component verify: PASS (no legacy @/components/ui in scanned trees)");
process.exit(0);
