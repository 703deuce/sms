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
  agentSource.includes("reschedule_appointment") ||
    agentSource.includes("buildFrontDeskRescheduleAppointmentTool"),
  "frontdesk agent includes reschedule tool",
);

const cancelSource = read("voice-runtime/src/frontdesk/cancel-appointment-tool.ts");
assert.ok(
  cancelSource.includes("syncFrontDeskCancelToCrm"),
  "cancel tool syncs CRM on cancel",
);

const rescheduleSource = read("voice-runtime/src/frontdesk/reschedule-appointment-tool.ts");
assert.ok(rescheduleSource.includes("rescheduleAppointmentResilient"));
assert.ok(rescheduleSource.includes("cancelCalendlyEventResilient") === false);
assert.ok(rescheduleSource.includes("resolveFrontDeskAppointment"));

const crmTypes = read("src/lib/crm/types.ts");
assert.ok(crmTypes.includes('"appointment.cancelled"'));

const crmEvents = read("src/lib/crm/events.ts");
assert.ok(crmEvents.includes("publishAppointmentCancelled"));

const transferSource = read("voice-runtime/src/frontdesk/transfer-tool.ts");
assert.ok(transferSource.includes("transferLiveKitSipParticipant"));
assert.ok(transferSource.includes("session.shutdown") === false);
assert.ok(agentSource.includes("session.shutdown"));

console.log("frontdesk integrations tests: PASS");
