#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const avail = readFileSync("src/lib/voice/agent-tool-gateway/availability-workflow.ts", "utf8");
assert.ok(avail.includes("runVoiceCanonicalAvailability"));
assert.ok(avail.includes("isVoiceCanonicalAiBookingActive"));

const book = readFileSync("src/lib/voice/agent-tool-gateway/booking-workflow.ts", "utf8");
assert.ok(book.includes("runVoiceCanonicalBook"));

const bridge = readFileSync("src/lib/voice/ai-booking/canonical-tool-bridge.ts", "utf8");
assert.ok(bridge.includes("orchestrateMctbAiBooking"));
assert.ok(bridge.includes("canonical_mctb_orchestrator"));
assert.ok(!bridge.includes("getAvailability("));

const send = readFileSync("src/lib/voice/tools/send-resource-consent.ts", "utf8");
assert.ok(send.includes("booking"));

const handlers = readFileSync("src/lib/jobs/job-handlers.ts", "utf8");
assert.ok(handlers.includes("voice_mctb_booking_create"));

const deprecated = readFileSync("src/lib/voice/ai-booking-bridge.ts", "utf8");
assert.ok(deprecated.includes("not supported") || deprecated.includes("@deprecated"));

const orch = readFileSync("src/lib/mctb/ai-booking/orchestrator.ts", "utf8");
assert.ok(orch.includes("export async function orchestrateMctbAiBooking"));
assert.ok(!readFileSync("src/lib/voice/ai-booking/canonical-tool-bridge.ts", "utf8").includes(
  "export async function orchestrateMctbAiBooking",
));

console.log("test-voice-canonical-ai-booking-architecture: ok");
