#!/usr/bin/env node
/**
 * Patch TS7006 implicit-any callback params from prisma compat queries.
 * Adds `: DbRow` and imports from @/lib/db where needed.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsc = spawnSync("npx", ["tsc", "--noEmit"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});
const output = `${tsc.stdout || ""}${tsc.stderr || ""}`;

const re =
  /^(src\/[^\(\s]+)\((\d+),(\d+)\): error TS7006: Parameter '(\w+)' implicitly has an 'any' type\./gm;
const byFile = new Map();

for (const m of output.matchAll(re)) {
  const [, file, line, col, param] = m;
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line: Number(line), col: Number(col), param });
}

function ensureDbRowImport(content) {
  if (!content.includes(": DbRow") && !content.includes(": DbRow[")) return content;
  if (/import\s+type\s+\{\s*DbRow\s*\}/.test(content)) return content;
  if (/import\s+\{[^}]*\bDbRow\b/.test(content)) return content;

  const dbImport = content.match(/^import\s+\{([^}]+)\}\s+from\s+"@\/lib\/db";?/m);
  if (dbImport) {
    const inner = dbImport[1].trim();
    if (inner.includes("DbRow")) return content;
    const replacement = inner.startsWith("type ")
      ? `import { ${inner}, type DbRow } from "@/lib/db";`
      : `import { ${inner}, type DbRow } from "@/lib/db";`;
    return content.replace(dbImport[0], replacement);
  }

  const firstImport = content.match(/^import .+;?\n/m);
  const importLine = 'import type { DbRow } from "@/lib/db";\n';
  if (firstImport) {
    return content.replace(firstImport[0], firstImport[0] + importLine);
  }
  return importLine + content;
}

let patchedFiles = 0;
let patchedParams = 0;

for (const [relFile, errs] of byFile) {
  const abs = path.join(root, relFile);
  if (!fs.existsSync(abs)) continue;

  const lines = fs.readFileSync(abs, "utf8").split("\n");
  errs.sort((a, b) => b.line - a.line || b.col - a.col);

  for (const { line, col, param } of errs) {
    const idx = line - 1;
    const text = lines[idx];
    if (!text) continue;

    const pos = col - 1;
    if (text.slice(pos, pos + param.length) !== param) continue;
    const afterParam = text.slice(pos + param.length);
    if (/^\s*:\s/.test(afterParam)) continue;

    lines[idx] = text.slice(0, pos) + `${param}: DbRow` + afterParam;
    patchedParams++;
  }

  let content = lines.join("\n");
  content = ensureDbRowImport(content);
  fs.writeFileSync(abs, content);
  patchedFiles++;
}

console.log(`Patched ${patchedParams} params across ${patchedFiles} files`);
