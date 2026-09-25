#!/usr/bin/env tsx
/**
 * Permanent Voice IA navigation reconciliation (static).
 * Run: npx tsx scripts/test-voice-ia-nav.ts
 */
import assert from "node:assert/strict";
import { buildAiAfterHoursNav, buildAiAfterHoursMobileNav } from "../src/lib/products/ai-after-hours-nav";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import {
  assertNoLegacyVoicePrimaryLabels,
  resolveVoiceIaNavParent,
  VOICE_IA_PRIMARY_DESTINATIONS,
  VOICE_IA_ROUTES,
  voiceIaPrimaryLabels,
} from "../src/lib/products/voice-ia-nav";

const expected = [
  ["Overview", VOICE_IA_ROUTES.overview],
  ["Calls", VOICE_IA_ROUTES.calls],
  ["Receptionist", VOICE_IA_ROUTES.receptionist],
  ["Business Knowledge", VOICE_IA_ROUTES.knowledge],
  ["Call Handling", VOICE_IA_ROUTES.callHandling],
  ["Analytics", VOICE_IA_ROUTES.analytics],
];

assert.deepEqual(
  VOICE_IA_PRIMARY_DESTINATIONS.map((d) => [d.label, d.href]),
  expected,
);

function voicePrimaryFromMctb() {
  return buildMctbV1Nav({ hasVoice: true }).filter((i) =>
    VOICE_IA_PRIMARY_DESTINATIONS.some((d) => d.href === i.href),
  );
}

function voicePrimaryFromStandalone() {
  return buildAiAfterHoursNav().filter((i) =>
    VOICE_IA_PRIMARY_DESTINATIONS.some((d) => d.href === i.href),
  );
}

for (const [label, href] of expected) {
  const m = voicePrimaryFromMctb().find((i) => i.label === label);
  assert.ok(m, `MCTB bundled missing ${label}`);
  assert.equal(m?.href, href);
  const s = voicePrimaryFromStandalone().find((i) => i.label === label);
  assert.ok(s, `Standalone missing ${label}`);
  assert.equal(s?.href, href);
}

assert.equal(voicePrimaryFromMctb().length, 6);
assert.equal(voicePrimaryFromStandalone().length, 6);

assertNoLegacyVoicePrimaryLabels(voiceIaPrimaryLabels(buildAiAfterHoursNav()));
assertNoLegacyVoicePrimaryLabels(voiceIaPrimaryLabels(buildMctbV1Nav({ hasVoice: true })));

assert.equal(resolveVoiceIaNavParent("/voice/calls/abc"), VOICE_IA_ROUTES.calls);
assert.equal(resolveVoiceIaNavParent("/voice/inbound-routing"), VOICE_IA_ROUTES.callHandling);
assert.equal(resolveVoiceIaNavParent("/voice/needs-attention"), VOICE_IA_ROUTES.calls);
assert.equal(resolveVoiceIaNavParent("/voice/operations"), VOICE_IA_ROUTES.callHandling);
assert.equal(resolveVoiceIaNavParent("/voice/analytics/after-hours"), VOICE_IA_ROUTES.analytics);

const mobile = buildAiAfterHoursMobileNav();
assert.ok(mobile.every((i) => !["AI Agent", "Agent", "Knowledge", "Inbound Routing"].includes(i.label)));

console.log("test-voice-ia-nav: PASS");
