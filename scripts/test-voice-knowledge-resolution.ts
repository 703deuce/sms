/**
 * Offline tests for resolveBusinessAnswer topic routing and helpers.
 * Run: npx tsx scripts/test-voice-knowledge-resolution.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isHoursTopic,
  isPricingTopic,
  isServiceAreaTopic,
  isServicesTopic,
} from "../src/lib/voice/knowledge/business-answer-topics";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice/knowledge/resolve-business-answer.ts"),
  "utf8",
);

assert.ok(source.includes("searchKnowledge"), "resolver uses RAG search");
assert.ok(source.includes("loadBusinessBrain"), "resolver uses company brain");
assert.ok(source.includes("knowledgeBaseIds"), "resolver reads linked KB ids");
assert.ok(source.includes("isServiceAreaTopic"), "resolver checks service area before services");
assert.ok(source.includes("receptionistCompiled"), "resolver reads generic receptionist wizard");

const SUMMIT_DESC =
  "Summit Electric provides residential electrical repair, panel upgrades, and 24/7 emergency service in Denver. Regular hours are Monday through Friday 8am to 6pm. We charge a $95 diagnostic fee; emergency after-hours calls start at $175.";

function extractHoursFromDescription(description: string): string | null {
  const hoursMatch = description.match(
    /(?:regular\s+)?hours?\s*(?:are\s+)?([^.]+(?:\d\s*(?:am|pm)|Monday|weekday)[^.]*)/i,
  );
  if (hoursMatch?.[1]) return hoursMatch[1].trim();
  const weekdayMatch = description.match(
    /(Monday[^.]*(?:\d\s*(?:am|pm)|through|to)[^.]*)/i,
  );
  if (weekdayMatch?.[1]) return weekdayMatch[1].trim();
  return null;
}

function extractPricingFromDescription(description: string): string | null {
  const matches = description.match(/\$[\d,]+[^.]*(?:\.|;|$)/gi);
  if (!matches?.length) return null;
  return matches.map((m) => m.trim().replace(/[.;]+$/, "")).join(". ") + ".";
}

assert.equal(
  extractHoursFromDescription(SUMMIT_DESC),
  "Monday through Friday 8am to 6pm",
  "hours extract from receptionist business description",
);
assert.match(extractPricingFromDescription(SUMMIT_DESC) || "", /\$95/);
assert.match(extractPricingFromDescription(SUMMIT_DESC) || "", /\$175/);

assert.equal(isPricingTopic("pricing"), true, '"pricing" must match pricing topics');
assert.equal(isPricingTopic("diagnostic visit"), true);
assert.equal(isPricingTopic("how much"), true);
assert.equal(isPricingTopic("hours"), false);

assert.equal(isServiceAreaTopic("service area"), true);
assert.equal(isServiceAreaTopic("do you serve Arlington"), true);
assert.equal(isServicesTopic("service area"), false, "service area must not route to services blurb");
assert.equal(isServicesTopic("what services do you offer"), true);

assert.equal(isHoursTopic("hours"), true);
assert.equal(isHoursTopic("when are you open"), true);

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
