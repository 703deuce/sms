#!/usr/bin/env npx tsx
/**
 * Isolation audit: booking-critical imports for Microsoft 365 certified pipeline.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src/lib/voice-receptionist-wizard/pipelines/microsoft-365-certified";
const ENTRY_FIND = join(ROOT, "find-availability.ts");
const ENTRY_BOOK = join(ROOT, "book-offered-slot.ts");
const INTERNAL = join(ROOT, "internal");

const ALLOWED_EXTERNAL = new Set([
  "@/lib/db",
  "@/lib/supabase/id",
]);

function parseImports(filePath: string): string[] {
  const src = readFileSync(filePath, "utf8");
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const m = line.match(/^\s*import\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?["']([^"']+)["']/);
    if (m) out.push(m[1]);
    const dm = line.match(/import\s*\(\s*["']([^"']+)["']\s*\)/);
    if (dm) out.push(dm[1]);
  }
  return out;
}

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...collectTsFiles(p));
    else if (name.endsWith(".ts")) files.push(p);
  }
  return files;
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/") || spec.startsWith("server-only")) return spec;
  if (spec.startsWith("./") || spec.startsWith("../")) {
    const base = join(fromFile, "..", spec);
    for (const ext of [".ts", ""]) {
      const candidate = ext ? base.replace(/\.ts$/, "") + ext : base + ".ts";
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        /* try next */
      }
    }
    return join(fromFile, "..", spec);
  }
  return spec;
}

function walkBookingGraph(entryFiles: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entryFiles];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of parseImports(file)) {
      const resolved = resolveImport(file, spec);
      if (!resolved) continue;
      if (resolved.startsWith("@/") || resolved.startsWith("server-only")) continue;
      if (resolved.endsWith(".ts") && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

const graph = walkBookingGraph([ENTRY_FIND, ENTRY_BOOK]);
const externalBooking: Array<{ file: string; spec: string }> = [];

for (const file of graph) {
  for (const spec of parseImports(file)) {
    if (spec.startsWith("@/lib/") && !ALLOWED_EXTERNAL.has(spec)) {
      externalBooking.push({ file: relative(process.cwd(), file), spec });
    }
    if (
      spec.includes("voice-v2/") &&
      !spec.includes("pipelines/microsoft-365-certified")
    ) {
      externalBooking.push({ file: relative(process.cwd(), file), spec });
    }
    if (spec.includes("voice-appointment-reconcile")) {
      externalBooking.push({ file: relative(process.cwd(), file), spec });
    }
    if (spec.includes("voice/calendar") && !file.includes("/internal/")) {
      externalBooking.push({ file: relative(process.cwd(), file), spec });
    }
  }
}

const internalFiles = collectTsFiles(INTERNAL);

console.log("=== Microsoft 365 certified booking import audit ===\n");
console.log("Entry FIND imports:", parseImports(ENTRY_FIND).join(", "));
console.log("Entry BOOK imports:", parseImports(ENTRY_BOOK).join(", "));
console.log("\nInternal frozen modules:", internalFiles.length);
console.log("Reachable from FIND/BOOK (local):", graph.size, "files\n");

if (externalBooking.length) {
  console.log("BOOKING-CRITICAL EXTERNAL IMPORTS (should be empty except allowlist):");
  for (const row of externalBooking) {
    console.log(`  ${row.file} -> ${row.spec}`);
  }
  process.exit(1);
}

console.log("PASS: no booking-critical imports outside microsoft-365-certified/internal");
console.log("Allowlisted externals only: getPrisma, createId");
