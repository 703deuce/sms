#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  deterministicIntentRouter,
  shouldRouteToScheduling,
} from "../src/lib/mctb/ai-booking/agents/router";
import { deterministicSchedulingSpecialist } from "../src/lib/mctb/ai-booking/agents/scheduling-specialist";
import { mapSpecialistToOrchestratorInput } from "../src/lib/mctb/ai-booking/agents/map-to-orchestrator";
import { ROUTER_CONFIDENCE_THRESHOLD } from "../src/lib/mctb/ai-booking/agents/types";

assert.ok(existsSync("src/lib/mctb/ai-booking/agents/router.ts"));
assert.ok(existsSync("src/lib/mctb/ai-booking/agents/scheduling-specialist.ts"));

const routerSrc = readFileSync("src/lib/mctb/ai-booking/agents/router.ts", "utf8");
const specialistSrc = readFileSync("src/lib/mctb/ai-booking/agents/scheduling-specialist.ts", "utf8");
assert.ok(!routerSrc.includes("listEventTypeAvailableTimes"));
assert.ok(!routerSrc.includes("getMicrosoftBusy"));
assert.ok(!specialistSrc.includes("bookEventInvitee"));
assert.ok(!specialistSrc.includes("createBooking("));

const sched = deterministicIntentRouter({ message: "Can someone come tomorrow?", aiBookingSessionActive: false });
assert.equal(sched.intent, "SCHEDULING");
assert.ok(shouldRouteToScheduling(sched));

const price = deterministicIntentRouter({ message: "How much does it cost?", aiBookingSessionActive: false });
assert.equal(price.intent, "GENERAL_CONVERSATION");
assert.ok(!shouldRouteToScheduling(price));

const slot = deterministicIntentRouter({ message: "3 works", aiBookingSessionActive: true });
assert.equal(slot.intent, "SCHEDULING");
assert.equal(slot.subintent, "BOOK_SLOT");

const noSlot = deterministicIntentRouter({ message: "3 works", aiBookingSessionActive: false });
assert.ok(noSlot.confidence < ROUTER_CONFIDENCE_THRESHOLD || noSlot.intent !== "SCHEDULING");

const spec = deterministicSchedulingSpecialist({
  message: "tomorrow afternoon",
  timezone: "America/New_York",
  offeredSlots: [],
  aiBookingSessionActive: false,
  now: new Date("2026-09-15T14:00:00.000Z"),
});
assert.equal(spec.action, "CHECK_AVAILABILITY");
assert.ok(spec.window_start);

const mapped = mapSpecialistToOrchestratorInput(spec, {
  workspaceId: "ws",
  conversationId: "c1",
  customerName: "Test",
  customerPhone: "+15551234567",
  timezone: "America/New_York",
  customerMessage: "tomorrow afternoon",
});
assert.ok(mapped?.windowStartUtc);

const runtime = readFileSync("src/lib/mctb/ai-booking/conversation-runtime.ts", "utf8");
assert.ok(runtime.includes("runIntentRouterAgent"));
assert.ok(runtime.includes("runSchedulingSpecialistAgent"));
assert.ok(runtime.includes("orchestrateMctbAiBooking"));

console.log("test-mctb-ai-booking-agents: OK");
