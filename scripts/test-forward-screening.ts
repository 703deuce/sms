/**
 * Press-1 forwarding screening policy tests (hermetic).
 * Run: npx tsx scripts/test-forward-screening.ts
 */
import assert from "node:assert/strict";
import {
  normalizeForwardUnansweredAction,
  readPersonalCallSettings,
} from "../src/lib/numbers/personal-call-settings";
import {
  requiresPress1Screening,
  defaultUnansweredAction,
  isScreeningAccepted,
  effectiveForwardRingSeconds,
  DEFAULT_FORWARD_RING_SECONDS,
} from "../src/lib/numbers/forward-screening";
import { resolveNumberInboundRoute } from "../src/lib/numbers/inbound-number-routing";
import { parseForwardOutcome } from "../src/lib/numbers/forward-call-outcomes";

assert.equal(defaultUnansweredAction(true), "transovo_voicemail");
assert.equal(defaultUnansweredAction(false), "destination_voicemail");
assert.equal(DEFAULT_FORWARD_RING_SECONDS, 20);

assert.equal(
  normalizeForwardUnansweredAction("voicemail", true),
  "transovo_voicemail",
);
assert.equal(
  normalizeForwardUnansweredAction("end", true),
  "hang_up",
);

const baseSettings = {
  incomingCallHandling: "forward" as const,
  forwardingEnabled: true,
  forwardTargets: ["+17038166017"],
  forwardUnansweredAction: "transovo_voicemail" as const,
  voicemailEnabled: true,
  forwardRingSeconds: 20,
  callScreeningEnabled: false,
};

const row = {
  id: "n1",
  workspaceId: "w1",
  e164: "+15551234567",
  provider: "telnyx",
  voiceForwardTo: "+17038166017",
  releasedAt: null,
  status: "Active",
  friendlyName: null,
  providerNumberId: "p1",
  webhookUrl: null,
  settingsJson: baseSettings,
} as import("@prisma/client").PhoneNumber;

const settings = readPersonalCallSettings(row);
assert.equal(requiresPress1Screening(settings), false);
assert.equal(settings.callScreeningEnabled, false);
assert.equal(effectiveForwardRingSeconds(settings), 20);

const route = resolveNumberInboundRoute(row);
assert.equal(route.kind, "forward");
if (route.kind === "forward") {
  assert.equal(route.callScreening, false);
  assert.equal(route.unansweredAction, "transovo_voicemail");
  assert.equal(route.ringSeconds, 20);
}

const screeningRow = {
  ...row,
  settingsJson: { ...baseSettings, callScreeningEnabled: true },
} as import("@prisma/client").PhoneNumber;
const screeningSettings = readPersonalCallSettings(screeningRow);
assert.equal(requiresPress1Screening(screeningSettings), true);
const screeningRoute = resolveNumberInboundRoute(screeningRow);
if (screeningRoute.kind === "forward") {
  assert.equal(screeningRoute.callScreening, true);
}

const destRow = {
  ...row,
  settingsJson: {
    ...baseSettings,
    forwardUnansweredAction: "destination_voicemail",
    voicemailEnabled: false,
    forwardRingSeconds: 20,
  },
} as import("@prisma/client").PhoneNumber;
const destSettings = readPersonalCallSettings(destRow);
assert.equal(requiresPress1Screening(destSettings), false);
assert.equal(effectiveForwardRingSeconds(destSettings), 45);
const destRoute = resolveNumberInboundRoute(destRow);
if (destRoute.kind === "forward") {
  assert.equal(destRoute.callScreening, false);
  assert.equal(destRoute.ringSeconds, 45);
}

assert.equal(isScreeningAccepted("notes\nscreening:accepted"), true);
assert.equal(parseForwardOutcome("[forward_outcome:SENT_TO_TRANSOVO_VOICEMAIL]"), "SENT_TO_TRANSOVO_VOICEMAIL");

console.log("test-forward-screening: ok");
