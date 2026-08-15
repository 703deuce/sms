/**
 * Audit LiveKit frontdesk tools for raw ToolError throws (should return TOOL_FEEDBACK).
 * Run: npx tsx scripts/audit-tool-feedback-coverage.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "voice-runtime/src/frontdesk");
const ALLOWLIST = new Set([
  "booking-operation-guard.ts", // guardCalendarTool legacy throw
  "appointment-lookup.ts", // internal resolve throws; tools use tryResolve
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const violations: string[] = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;
  const src = fs.readFileSync(file, "utf8");
  if (src.includes("throw new llm.ToolError")) {
    violations.push(rel);
  }
}

if (violations.length) {
  console.error("Tools still throwing llm.ToolError (should return TOOL_FEEDBACK):");
  for (const v of violations) console.error(" -", v);
  process.exit(1);
}

console.log("tool feedback audit: PASS (no disallowed ToolError throws in frontdesk tools)");
