#!/usr/bin/env node
/**
 * Delete whole source files not reachable from MCTB production entry points.
 * Simple rule: if no remaining app/middleware/instrumentation file imports it, remove it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

const ENTRY_ROOTS = [
  "src/middleware.ts",
  "src/instrumentation.ts",
  "src/app",
];

const PRUNE_ROOTS = ["src/lib", "src/components"];

/** Never delete — MCTB core even if static trace misses dynamic imports */
const PROTECTED_PREFIXES = [
  "src/lib/mctb/",
  "src/lib/agents/missed-call-text-back/",
  "src/lib/solutions/missed-call-text-back/",
  "src/lib/smart-routing/",
];

function walkFiles(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const name of fs.readdirSync(abs)) {
    const a = path.join(abs, name);
    const rel = path.join(dir, name).replace(/\\/g, "/");
    const st = fs.statSync(a);
    if (st.isDirectory()) walkFiles(rel, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(rel);
  }
  return out;
}

const importRe =
  /(?:import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|import\s*\(|await\s+import\s*\()\s*['"]([^'"]+)['"]/g;

function resolveImport(fromFile, spec) {
  let target;
  if (spec.startsWith("@/")) {
    target = path.join(ROOT, "src", spec.slice(2));
  } else if (spec.startsWith(".")) {
    target = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  } else {
    return null;
  }
  const exts = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
  for (const ext of exts) {
    const candidate = target + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(ROOT, candidate).replace(/\\/g, "/");
    }
  }
  return null;
}

function trace(entryFiles) {
  const visited = new Set();
  const queue = [...entryFiles];
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    let src;
    try {
      src = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    importRe.lastIndex = 0;
    let m;
    while ((m = importRe.exec(src))) {
      const resolved = resolveImport(file, m[1]);
      if (!resolved || visited.has(resolved)) continue;
      queue.push(resolved);
    }
  }
  return visited;
}

const entryFiles = [];
for (const r of ENTRY_ROOTS) {
  const abs = path.join(ROOT, r);
  if (!fs.existsSync(abs)) continue;
  if (fs.statSync(abs).isFile()) entryFiles.push(r);
  else entryFiles.push(...walkFiles(r));
}
const uniqueEntries = [...new Set(entryFiles)];
const reachable = trace(uniqueEntries);

const toDelete = [];
for (const root of PRUNE_ROOTS) {
  for (const file of walkFiles(root)) {
    if (PROTECTED_PREFIXES.some((p) => file.startsWith(p))) continue;
    if (!reachable.has(file)) toDelete.push(file);
  }
}

toDelete.sort((a, b) => b.length - a.length);

console.log(`Entry files: ${uniqueEntries.length}`);
console.log(`Reachable: ${reachable.size}`);
console.log(`To delete: ${toDelete.length}`);

if (DRY) {
  for (const f of toDelete.slice(0, 50)) console.log(`  ${f}`);
  if (toDelete.length > 50) console.log(`  ... and ${toDelete.length - 50} more`);
  process.exit(0);
}

let deleted = 0;
for (const rel of toDelete) {
  fs.unlinkSync(path.join(ROOT, rel));
  deleted++;
}

// Remove empty directories
for (const root of PRUNE_ROOTS) {
  (function rmEmpty(dir) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return;
    for (const name of fs.readdirSync(abs)) {
      const child = path.join(dir, name).replace(/\\/g, "/");
      const childAbs = path.join(ROOT, child);
      if (fs.statSync(childAbs).isDirectory()) rmEmpty(child);
    }
    if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
  })(root);
}

console.log(`Deleted ${deleted} files`);
