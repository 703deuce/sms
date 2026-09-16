/**
 * Headless checks for Voice V2 reschedule/cancel helpers.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-appointment-changes-headless.ts
 */
import assert from "node:assert/strict";
import { subtractBusyInterval } from "../src/lib/voice-v2/appointment-changes/busy-exclude";
import { clearVoiceV2CallSessions, setVoiceV2CallContext } from "../src/lib/voice-v2/intake/session-store";
import {
  resolveStoredAppointmentRef,
  storeAppointmentRefs,
} from "../src/lib/voice-v2/appointment-changes/ref-store";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";

const sessionKey = "cc:appt-change-test";
clearVoiceV2CallSessions();

const baseCtx: VoiceV2CallContext = {
  sessionKey,
  workspaceId: "ws_test",
  agentId: "agent_test",
  businessTimezone: "America/Los_Angeles",
  intakeSchema: { fields: [] },
  intakeState: {},
  askedFields: {},
  compiledAt: new Date().toISOString(),
};
setVoiceV2CallContext(baseCtx);

const ref = {
  refId: "v2appt_test1",
  provider: "microsoft" as const,
  providerEventId: "evt_1",
  connectionId: "conn_1",
  timezone: "America/Los_Angeles",
  startsAtUtc: "2026-09-17T21:00:00.000Z",
  endsAtUtc: "2026-09-17T22:00:00.000Z",
  spokenLabel: "Tuesday 2 PM",
};

storeAppointmentRefs({ sessionKey, intent: "RESCHEDULE", refs: [ref], selectedRefId: ref.refId });
const loaded = resolveStoredAppointmentRef(sessionKey, ref.refId);
assert.equal(loaded?.providerEventId, "evt_1");

const busy = [
  {
    start: new Date("2026-09-17T21:00:00.000Z"),
    end: new Date("2026-09-17T22:00:00.000Z"),
  },
];
const trimmed = subtractBusyInterval(busy, {
  start: new Date("2026-09-17T21:00:00.000Z"),
  end: new Date("2026-09-17T22:00:00.000Z"),
});
assert.equal(trimmed.length, 0, "exclude own appointment frees slot for reschedule FIND");

console.log("test-voice-v2-appointment-changes-headless: PASS");
