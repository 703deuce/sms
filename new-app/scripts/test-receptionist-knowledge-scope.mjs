/**
 * Guards receptionist knowledge compile: no workspace-wide KB bleed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "../lib/server/receptionist/knowledge-compile.ts"), "utf8");

assert.ok(
  !src.includes('status: "active"'),
  "knowledge-compile must not load all active workspace knowledge bases",
);
assert.ok(
  src.includes("voiceAgentKnowledgeBase.findMany"),
  "knowledge-compile must use agent knowledge links only",
);
assert.ok(
  src.includes("if (!knowledgeBaseIds.length)"),
  "knowledge-compile must early-return when no linked KBs",
);

console.log("test-receptionist-knowledge-scope: PASS");
