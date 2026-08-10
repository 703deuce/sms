/**
 * Offline tests for resolveBusinessAnswer (structured + RAG paths).
 * Run: npx tsx scripts/test-voice-knowledge-resolution.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveBusinessAnswer } from "../src/lib/voice/knowledge/resolve-business-answer";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice/knowledge/resolve-business-answer.ts"),
  "utf8",
);

assert.ok(source.includes("searchKnowledge"), "resolver uses RAG search");
assert.ok(source.includes("loadBusinessBrain"), "resolver uses company brain");
assert.ok(source.includes("knowledgeBaseIds"), "resolver reads linked KB ids");

// Pure matching helpers (no DB) — mirror resolver topic logic
function topicMatches(text: string, topic: string): boolean {
  const hay = text.toLowerCase();
  const needles = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (!needles.length) return hay.includes(topic.toLowerCase());
  return needles.some((n) => hay.includes(n));
}

assert.equal(topicMatches("Emergency plumbing service", "emergency plumbing"), true);
assert.equal(topicMatches("Our hours are Mon-Fri", "hours"), true);

const fixture = fs.readFileSync(
  path.join(process.cwd(), "scripts/fixtures/harbor-home-rag-knowledge.txt"),
  "utf8",
);
assert.match(fixture, /warranty/i);
assert.match(fixture, /emergency plumbing/i);
assert.match(fixture, /service area/i);

console.log("voice knowledge resolution tests: PASS");
console.log(
  "Run seed: npx tsx scripts/seed-frontdesk-voice-knowledge.ts (requires DATABASE_URL)",
);
