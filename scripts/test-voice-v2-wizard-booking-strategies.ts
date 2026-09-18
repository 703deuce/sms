/**
 * Booking strategy → advanced config + Voice V2 capability snapshot (no UI).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-wizard-booking-strategies.ts
 */
import assert from "node:assert/strict";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { resolveVoiceV2BookingStrategy } from "../src/lib/voice-receptionist-wizard/booking-strategy";
import { buildVoiceV2CallCapabilitySnapshot } from "../src/lib/voice-receptionist-wizard/workflow-capability";

type Strat = "NONE" | "REQUEST_ONLY" | "SEND_LINK" | "MICROSOFT_365" | "CALENDLY";

function cfgFor(strategy: Strat) {
  const state = createDefaultWizardState();
  state.bookingStrategy = strategy;
  if (strategy === "NONE") {
    state.capabilities = state.capabilities.filter((c) => c !== "book_appointments");
    state.capabilities.push("take_messages");
  } else {
    if (!state.capabilities.includes("book_appointments")) {
      state.capabilities.push("book_appointments");
    }
  }
  if (strategy === "SEND_LINK") {
    state.bookingLinkUrl = "https://example.com/book";
  }
  if (strategy === "MICROSOFT_365") {
    state.calendarProvider = "microsoft";
    state.calendarConnected = true;
  }
  if (strategy === "CALENDLY") {
    state.calendarProvider = "calendly";
    state.calendarConnected = true;
    state.calendlyEventTypeUri = "https://api.calendly.com/event_types/test";
  }
  return buildWizardAgentConfig(state);
}

function assertStrategy(strategy: Strat) {
  const cfg = cfgFor(strategy);
  const resolved = resolveVoiceV2BookingStrategy(cfg);
  assert.equal(resolved, strategy, `resolveVoiceV2BookingStrategy ${strategy}`);
  const adv = cfg.advanced as Record<string, unknown>;
  assert.equal(adv.bookingStrategy, strategy, `advanced.bookingStrategy ${strategy}`);
  const live = strategy === "MICROSOFT_365" || strategy === "CALENDLY";
  assert.equal(adv.voiceV2PstnLiveBooking, live, `voiceV2PstnLiveBooking ${strategy}`);
  const cap = buildVoiceV2CallCapabilitySnapshot(cfg);
  assert.equal(cap.bookingStrategy, strategy);
  assert.equal(cap.findToolAvailable, live, `find ${strategy}`);
  assert.equal(cap.bookToolAvailable, live, `book ${strategy}`);
  assert.equal(cap.sendBookingLinkToolAvailable, strategy === "SEND_LINK", `send link ${strategy}`);
  if (strategy === "NONE" || strategy === "REQUEST_ONLY") {
    assert.equal(cap.findToolAvailable, false);
    assert.equal(cap.bookToolAvailable, false);
  }
}

for (const s of [
  "NONE",
  "REQUEST_ONLY",
  "SEND_LINK",
  "MICROSOFT_365",
  "CALENDLY",
] as Strat[]) {
  assertStrategy(s);
}

console.log("test-voice-v2-wizard-booking-strategies: PASS");
