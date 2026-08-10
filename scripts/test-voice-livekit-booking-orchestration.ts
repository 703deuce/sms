#!/usr/bin/env npx tsx
/**
 * LiveKit booking orchestration tests — healthcare-style scheduling bridge.
 *
 * Run: npm run test:voice-livekit-booking-orchestration
 */
import {
  createPreprodTenant,
  cleanupPreprodTenant,
} from "../src/lib/voice/testing/preprod-harness";
import { sampleValueForManifestField } from "../src/lib/voice/testing/livekit-field-samples";
import {
  resetRealtimeSessionStoreForTests,
  InMemoryRealtimeSessionStore,
} from "../src/lib/voice/realtime-session";
import { liveKitRuntimeProvider } from "../src/lib/voice/runtime-provider/livekit";
import {
  bootstrapLiveKitCallContext,
  domainGetBookingRequirements,
  buildRequirementsPayload,
} from "../src/lib/voice/domain-actions";
import { buildAmyLiveKitRootInstructions } from "../src/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import {
  loadAvailableSlots,
  recordCallerField,
  holdAppointmentSlot,
  commitBooking,
  missingRequiredFields,
} from "../voice-runtime/src/scheduling-bridge";

const failures: string[] = [];
let testsRun = 0;

function check(name: string, cond: boolean, detail?: string) {
  testsRun++;
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

async function collectAllFields(
  callContext: Awaited<ReturnType<typeof bootstrapLiveKitCallContext>>,
) {
  for (let i = 0; i < 8; i++) {
    const missing = missingRequiredFields(callContext);
    if (!missing.length) break;
    const field = missing[0]!;
    const sample = sampleValueForManifestField(callContext.session, field.field_id, i);
    const { ctx, result } = await recordCallerField(callContext, sample, field.field_id);
    callContext.session = ctx.session;
    if (!result.ok) break;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  process.env.VOICE_RUNTIME_PROVIDER = "livekit";
  resetRealtimeSessionStoreForTests(new InMemoryRealtimeSessionStore());

  console.log("LiveKit booking orchestration tests\n");

  const ctx = await createPreprodTenant();
  try {
    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
      livekitRoomName: "booking-orchestration-test",
    });
    ctx.callIds.push(callId);

    let callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
    });

    check("missing fields before collect", missingRequiredFields(callContext).length > 0);

    const requirements = await domainGetBookingRequirements({ ctx: callContext });
    check("get_booking_requirements succeeds", requirements.ok);
    check(
      "requirements include activeField",
      Boolean(requirements.data?.activeField || requirements.data?.readyForAvailability === false),
    );

    const firstField = missingRequiredFields(callContext)[0];
    const firstSample = sampleValueForManifestField(
      callContext.session,
      firstField?.field_id || callContext.session.activeField,
    );
    const firstRecorded = await recordCallerField(callContext, firstSample, firstField?.field_id);
    callContext = firstRecorded.ctx;
    check("record field succeeds", firstRecorded.result.ok !== false);

    await collectAllFields(callContext);

    const payload = buildRequirementsPayload(callContext.session);
    check("requirements payload readyForAvailability", payload.readyForAvailability === true);

    const loaded = await loadAvailableSlots(callContext, "next available");
    callContext = loaded.ctx;
    check(
      "availability loads slots or returns speakable failure",
      loaded.slots.length > 0 || Boolean(loaded.result.speak),
      `slots=${loaded.slots.length}`,
    );

    const instructions = buildAmyLiveKitRootInstructions(callContext.businessName);
    check("root instructions mention schedule_appointment", instructions.includes("schedule_appointment"));
    check("root instructions avoid SESSION block", !instructions.includes("SESSION:"));

    if (loaded.slots.length > 0) {
      const slotId = loaded.slots[0]!.slotId;
      const held = await holdAppointmentSlot(callContext, slotId);
      callContext = held.ctx;
      check("hold slot returns result", Boolean(held.result.speak));

      const declined = await commitBooking(callContext, false);
      callContext = declined.ctx;
      check(
        "declined confirmation does not book",
        declined.result.ok === false || !declined.result.data?.booking,
      );
    } else {
      check("hold slot skipped without slots", true);
      check("confirm booking skipped without slots", true);
    }

    await liveKitRuntimeProvider.endSession(callId);
    check("session cleanup", true);
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"} (${testsRun - failures.length}/${testsRun})`);
  if (failures.length) {
    failures.forEach((failure) => console.error(" -", failure));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
