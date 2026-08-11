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
const bookingToolsSource = read("voice-runtime/src/frontdesk/booking-tools.ts");
assert.ok(
  !agentSource.includes("GetEmailTask") && !bookingToolsSource.includes("GetEmailTask"),
  "frontdesk agent must not use GetEmailTask (agent_handoff)",
);
assert.ok(
  bookingToolsSource.includes("runEmailCollectionTask"),
  "frontdesk booking uses EmailCollectionTask for email gate",
);
assert.ok(
  bookingToolsSource.includes("buildEndCallToolset"),
  "frontdesk booking uses LiveKit end-call toolset",
);
assert.ok(
  bookingToolsSource.includes("syncFrontDeskBookingToCrm"),
  "frontdesk booking tools sync CRM on book",
);
assert.ok(
  bookingToolsSource.includes("buildFrontDeskRescheduleAppointmentTool"),
  "frontdesk booking tools include reschedule tool",
);
assert.ok(
  agentSource.includes("buildFrontDeskBookingTools"),
  "frontdesk agent uses shared booking tools module",
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

assert.ok(
  bookingToolsSource.includes("buildFrontDeskCheckBookingStatusTool"),
  "frontdesk includes check_booking_status tool",
);
assert.ok(
  bookingToolsSource.includes("speakBookingLine"),
  "frontdesk uses Realtime-safe scripted speech for booking lines",
);
assert.ok(!bookingToolsSource.includes("runCtx.update(POST_EMAIL_BOOKING_FILLER)"));

console.log("frontdesk integrations tests: PASS");
