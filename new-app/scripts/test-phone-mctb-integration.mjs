#!/usr/bin/env node
/**
 * Phone-owned MCTB integration checks (no live Telnyx).
 * Run: npx tsx new-app/scripts/test-phone-mctb-integration.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(root, "../lib/mctb/first-text-templates/registry.ts");
const registrySrc = readFileSync(registryPath, "utf8");

assert.match(registrySrc, /id: "simple"/);
assert.match(registrySrc, /id: "on_a_job"/);
assert.match(registrySrc, /id: "quick_question"/);
assert.match(registrySrc, /id: "callback_time"/);
assert.match(registrySrc, /id: "what_do_you_need"/);
assert.match(registrySrc, /Sorry we missed your call/);

const { classifyInboundCallOutcome, classificationTriggersMctb } = await import(
  "../lib/server/mctb/classify.ts"
);

const answered = classifyInboundCallOutcome({
  direction: "inbound",
  status: "completed",
  disposition: "answered",
  answeredAt: new Date(),
});
assert.equal(answered, "answered");

const missed = classifyInboundCallOutcome({
  direction: "inbound",
  status: "missed",
  disposition: "missed:no_answer",
});
assert.equal(missed, "missed_no_answer");
assert.equal(
  classificationTriggersMctb(missed, {
    sendAfterNoAnswer: true,
    sendAfterBusy: false,
    sendAfterRejected: false,
    sendAfterTimeout: false,
    sendAfterVoicemail: false,
  }),
  true,
);

const { renderMctbFirstTextPreviewExample } = await import(
  "../lib/mctb/first-text-templates/render.ts"
);
const simplePreview = renderMctbFirstTextPreviewExample("simple", "Acme Co");
const jobPreview = renderMctbFirstTextPreviewExample("on_a_job", "Acme Co");
assert.notEqual(simplePreview, jobPreview);
assert.match(simplePreview, /Acme Co/);

console.log("test-phone-mctb-integration: PASS");
