import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const newui2 = readFileSync(join(root, "newui2/app/globals.css"), "utf8");
const shell = readFileSync(join(root, "src/styles/newui-shell-tokens.css"), "utf8");
const appShell = readFileSync(join(root, "src/components/layout/app-shell.tsx"), "utf8");
const productTheme = readFileSync(join(root, "src/app/(app)/product-theme.css"), "utf8");
const kit = readFileSync(join(root, "src/newui-transplant/components/app/kit.tsx"), "utf8");

function extractRootBlock(css: string): string {
  const start = css.indexOf(":root {");
  if (start < 0) return "";
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

const sourceRoot = extractRootBlock(newui2);

/** Production Opus shell tracks newui2 palette (not legacy Kimi indigo/teal). */
const requiredFromNewui2 = [
  "--primary: oklch(0.51 0.22 277)",
  "--sidebar: oklch(0.17 0.02 272)",
  "--sidebar-muted: oklch(0.62 0.02 270)",
  "--success: oklch(0.6 0.15 158)",
  "--chart-1: oklch(0.51 0.22 277)",
  "--chart-2: oklch(0.7 0.14 190)",
  "--destructive: oklch(0.58 0.22 25)",
];

for (const token of requiredFromNewui2) {
  assert.ok(sourceRoot.includes(token), `newui2 source missing ${token}`);
  assert.ok(shell.includes(token), `shell tokens missing ${token}`);
}

assert.doesNotMatch(shell, /0\.12 168/, "shell should not retain old teal primary family");

assert.match(productTheme, /\.product-theme:not\(\[data-newui-shell\]\)/);
assert.doesNotMatch(
  appShell,
  /data-newui-shell="true"[\s\S]{0,120}product-theme/,
  "Opus shell must not combine product-theme with data-newui-shell",
);

const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
assert.match(globals, /--color-sidebar-accent: var\(--sidebar-accent\)/);
assert.match(globals, /--color-chart-1: var\(--chart-1\)/);

assert.match(kit, /FeatureEmphasisStrip/);
assert.match(kit, /Callout/);
assert.match(kit, /'info'/);
assert.match(kit, /SetupProgressBar/);
assert.match(kit, /SettingRow/);
assert.match(kit, /KeyValueRow/);

const surfaces = readFileSync(join(root, "src/newui-transplant/components/app/opus-surfaces.ts"), "utf8");
assert.match(surfaces, /OPUS_CARD/);
assert.match(surfaces, /OPUS_TABLE_HEAD/);
assert.match(surfaces, /shadow-\[0_1px_2px_rgba\(16,18,40,0\.04\)\]/);

const tables = readFileSync(join(root, "src/newui-transplant/components/app/opus-tables.tsx"), "utf8");
const simpleSelect = readFileSync(join(root, "src/newui-transplant/components/app/simple-select.tsx"), "utf8");
assert.match(tables, /MissedCallsCompactTable/);
assert.match(tables, /bg-muted\/40/);
assert.match(simpleSelect, /SimpleSelect/);

console.log("test-opus-visual-token-parity: PASS");
