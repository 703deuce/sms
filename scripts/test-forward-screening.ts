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
} from "../src/lib/numbers/forward-screening";
import { resolveNumberInboundRoute } from "../src/lib/numbers/inbound-number-routing";
import { parseForwardOutcome } from "../src/lib/numbers/forward-call-outcomes";

assert.equal(defaultUnansweredAction(true), "transovo_voicemail");
assert.equal(defaultUnansweredAction(false), "destination_voicemail");

assert.equal(
  normalizeForwardUnansweredAction("voicemail", true),
  "transovo_voicemail",
);
assert.equal(
  normalizeForwardUnansweredAction("end", true),
  "hang_up",
);

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
  settingsJson: {
    incomingCallHandling: "forward",
    forwardingEnabled: true,
    forwardTargets: ["+17038166017"],
    forwardUnansweredAction: "transovo_voicemail",
    voicemailEnabled: true,
    forwardRingSeconds: 25,
  },
} as import("@prisma/client").PhoneNumber;

const settings = readPersonalCallSettings(row);
assert.equal(requiresPress1Screening(settings), true);
assert.equal(settings.callScreeningEnabled, true);

const route = resolveNumberInboundRoute(row);
assert.equal(route.kind, "forward");
if (route.kind === "forward") {
  assert.equal(route.callScreening, true);
  assert.equal(route.unansweredAction, "transovo_voicemail");
}

const destRow = {
  ...row,
  settingsJson: {
    ...row.settingsJson,
    forwardUnansweredAction: "destination_voicemail",
    voicemailEnabled: false,
  },
} as import("@prisma/client").PhoneNumber;
const destSettings = readPersonalCallSettings(destRow);
assert.equal(requiresPress1Screening(destSettings), false);
const destRoute = resolveNumberInboundRoute(destRow);
if (destRoute.kind === "forward") {
  assert.equal(destRoute.callScreening, false);
}

assert.equal(isScreeningAccepted("notes\nscreening:accepted"), true);
assert.equal(parseForwardOutcome("[forward_outcome:SENT_TO_TRANSOVO_VOICEMAIL]"), "SENT_TO_TRANSOVO_VOICEMAIL");

console.log("test-forward-screening: ok");
