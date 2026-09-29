import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "newui/app/globals.css"), "utf8");
const shell = readFileSync(join(root, "src/styles/newui-shell-tokens.css"), "utf8");
const appShell = readFileSync(join(root, "src/components/layout/app-shell.tsx"), "utf8");
const productTheme = readFileSync(join(root, "src/app/(app)/product-theme.css"), "utf8");

function extractRootBlock(css: string): string {
  const start = css.indexOf(":root {");
  if (start < 0) return "";
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

const sourceRoot = extractRootBlock(source);

const required = [
  "--sidebar: oklch(0.19 0.012 260)",
  "--primary: oklch(0.52 0.12 168)",
  "--success: oklch(0.58 0.13 155)",
  "--chart-1: oklch(0.52 0.12 168)",
  "--chart-3: oklch(0.72 0.15 70)",
  "--sidebar-accent: oklch(0.26 0.012 260)",
  "--destructive: oklch(0.58 0.2 25)",
];

for (const token of required) {
  assert.ok(sourceRoot.includes(token), `newui source missing ${token}`);
  assert.ok(shell.includes(token), `shell tokens missing ${token}`);
}

assert.match(productTheme, /\.product-theme:not\(\[data-newui-shell\]\)/);
assert.doesNotMatch(
  appShell,
  /data-newui-shell="true"[\s\S]{0,120}product-theme/,
  "Opus shell must not combine product-theme with data-newui-shell",
);

const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
assert.match(globals, /--color-sidebar-accent: var\(--sidebar-accent\)/);
assert.match(globals, /--color-chart-1: var\(--chart-1\)/);
assert.match(globals, /--color-destructive: var\(--destructive\)/);

console.log("test-opus-visual-token-parity: PASS");
