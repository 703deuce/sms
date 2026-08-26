/**
 * Regression: Mass Texting must not import MCTB voice/SIP runtime modules.
 *
 * Run: npx tsx scripts/test-mass-texting-boundary.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { MASS_TEXTING_PROHIBITED_IMPORT_PREFIXES } from "../src/lib/mass-texting/constants";

const ROOT = join(process.cwd(), "src/lib/mass-texting");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTsFiles(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walkTsFiles(ROOT);
assert.ok(files.length > 0, "mass-texting lib should exist");

for (const file of files) {
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  for (const banned of MASS_TEXTING_PROHIBITED_IMPORT_PREFIXES) {
    assert.doesNotMatch(
      src,
      new RegExp(`from ["']@/${banned.replace(/\//g, "\\/")}`),
      `${rel} must not import prohibited module @/${banned}`,
    );
  }
}

console.log("test-mass-texting-boundary: ok");
