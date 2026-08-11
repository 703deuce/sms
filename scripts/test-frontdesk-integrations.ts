/**
 * Static regression tests for frontdesk integration completion.
 * Run: npx tsx scripts/test-frontdesk-integrations.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const agentSource = read("voice-runtime/src/frontdesk/frontdesk-booking-agent.ts");
assert.ok(
  !agentSource.includes("GetEmailTask"),
  "frontdesk agent must not use GetEmailTask (agent_handoff)",
);
assert.ok(
  agentSource.includes("buildFrontDeskEmailTools"),
  "frontdesk agent includes inline email tools",
);
assert.ok(
  agentSource.includes("syncFrontDeskBookingToCrm"),
  "frontdesk agent syncs CRM on book",
);
assert.ok(
  agentSource.includes("buildFrontDeskRescheduleAppointmentTool"),
  "frontdesk agent includes reschedule tool",
);

const cancelSource = read("voice-runtime/src/frontdesk/cancel-appointment-tool.ts");
assert.ok(
  cancelSource.includes("syncFrontDeskCancelToCrm"),
  "cancel tool syncs CRM on cancel",
);

const recoverySource = read("voice-runtime/src/frontdesk/booking-recovery.ts");
assert.ok(
  recoverySource.includes("lookupAppointmentIdForCallWithRetry"),
  "booking recovery retries appointment id lookup",
);
assert.ok(
  recoverySource.includes("deleteMany") && recoverySource.includes("rescheduledVia"),
  "reschedule dedupes duplicate product-persist rows",
);
assert.ok(
  /const booked = await cal\.scheduleAppointment[\s\S]*cancelCalendlyEventResilient/.test(
    recoverySource,
  ),
  "reschedule books new slot before cancelling old event",
);

const rescheduleSource = read("voice-runtime/src/frontdesk/reschedule-appointment-tool.ts");
assert.ok(rescheduleSource.includes("rescheduleAppointmentResilient"));
assert.ok(!rescheduleSource.includes("lookupAppointmentIdForCall"));
assert.ok(rescheduleSource.includes("resolveFrontDeskAppointment"));

const transferSource = read("voice-runtime/src/frontdesk/transfer-tool.ts");
assert.ok(transferSource.includes("transferLiveKitSipParticipant"));
assert.ok(transferSource.includes("ud.livekitRoomName"));

const livekitBootstrap = read("src/lib/voice/runtime-provider/livekit.ts");
assert.ok(
  livekitBootstrap.includes("livekitRoomName") && livekitBootstrap.includes("lightweightBootstrap"),
  "bootstrap patches livekit transfer metadata on existing calls",
);

const crmTypes = read("src/lib/crm/types.ts");
assert.ok(crmTypes.includes('"appointment.cancelled"'));

const crmEvents = read("src/lib/crm/events.ts");
assert.ok(crmEvents.includes("publishAppointmentCancelled"));

assert.ok(agentSource.includes("session.shutdown"));

console.log("frontdesk integrations tests: PASS");
