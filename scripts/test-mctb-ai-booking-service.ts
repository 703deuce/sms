#!/usr/bin/env tsx
/**
 * MCTB AI Booking service — architecture guards (no live provider calls).
 * Run: npx tsx scripts/test-mctb-ai-booking-service.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  pickSlotsToOffer,
  resolveOfferedSlotChoice,
  findSlotAtTime,
  nearestSlotAlternatives,
} from "../src/lib/mctb/ai-booking/slot-presentation";
import { slotIdFor } from "../src/lib/mctb/ai-booking/slot-id";
import type { MctbBookingSlot } from "../src/lib/mctb/ai-booking/types";

const required = [
  "src/lib/mctb/ai-booking/service.ts",
  "src/lib/mctb/ai-booking/orchestrator.ts",
  "src/lib/mctb/ai-booking/capabilities.ts",
  "src/lib/mctb/ai-booking/providers/calendly.ts",
  "src/lib/mctb/ai-booking/providers/microsoft.ts",
  "src/lib/mctb/ai-booking/providers/zoho.ts",
  "src/app/api/mctb/ai-booking/route.ts",
  "docs/MCTB-AI-BOOKING-ARCHITECTURE.md",
];

for (const f of required) {
  assert.ok(existsSync(f), `missing ${f}`);
}

const service = readFileSync("src/lib/mctb/ai-booking/service.ts", "utf8");
assert.ok(service.includes("getBookingProviders"));
assert.ok(service.includes("export async function getBookingContext"));
assert.ok(service.includes("export async function findAvailableTimes"));
assert.ok(service.includes("export async function createBooking"));
assert.ok(service.includes("export async function getBookingStatus"));
assert.ok(!service.includes("openai"), "service must not call LLM");

const orchestrator = readFileSync("src/lib/mctb/ai-booking/orchestrator.ts", "utf8");
assert.ok(orchestrator.includes("findAvailableTimes"));
assert.ok(orchestrator.includes("fallbackResult"));
assert.ok(!orchestrator.includes("business hours"), "must not guess from business hours");

const zoho = readFileSync("src/lib/mctb/ai-booking/providers/zoho.ts", "utf8");
assert.ok(zoho.includes("CRM connection only"));

const convActions = readFileSync("src/components/mctb/booking/conversation-booking-actions.tsx", "utf8");
assert.ok(!convActions.includes("graph.microsoft"), "conversation UI must not call Graph");

const slots: MctbBookingSlot[] = [
  { slotId: "a", startUtc: "2026-09-19T13:30:00.000Z", endUtc: "2026-09-19T14:00:00.000Z", timezone: "UTC" },
  { slotId: "b", startUtc: "2026-09-19T17:00:00.000Z", endUtc: "2026-09-19T17:30:00.000Z", timezone: "UTC" },
  { slotId: "c", startUtc: "2026-09-19T19:30:00.000Z", endUtc: "2026-09-19T20:00:00.000Z", timezone: "UTC" },
];
const offer = pickSlotsToOffer(slots, 3);
assert.equal(offer.length, 3);
assert.equal(findSlotAtTime(slots, "2026-09-19T17:00:00.000Z")?.slotId, "b");
const alts = nearestSlotAlternatives(slots, "2026-09-19T16:00:00.000Z", 2);
assert.equal(alts.length, 2);
assert.equal(resolveOfferedSlotChoice(slots, "third")?.slotId, "c");
assert.ok(slotIdFor("2026-01-01T15:00:00.000Z", "2026-01-01T15:30:00.000Z", "calendly").startsWith("slot_"));

const matrix = readFileSync("docs/MCTB-AI-BOOKING-PROVIDER-MATRIX.md", "utf8");
assert.ok(matrix.includes("Get booking/calendar configuration"));
assert.ok(matrix.includes("Check availability"));
assert.ok(matrix.includes("Create booking"));

console.log("test-mctb-ai-booking-service: OK");
