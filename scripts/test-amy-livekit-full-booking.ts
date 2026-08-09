#!/usr/bin/env npx tsx
/**
 * Full LiveKit booking path — fields → availability → slot → confirm.
 * Run: npm run test:amy-livekit-full-booking
 */
import { getPrisma } from "../src/lib/db";
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
  domainRecordField,
  domainCheckAvailability,
  domainSelectSlot,
  domainConfirmBooking,
  taskForWorkflowState,
  toolsForTaskWithChain,
} from "../src/lib/voice/domain-actions";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
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
    if (!callContext.session.missingFieldIds.length) break;
    const sample = sampleValueForManifestField(
      callContext.session,
      callContext.session.activeField,
      i,
    );
    const result = await domainRecordField({ ctx: callContext, value: sample });
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

  console.log("Amy LiveKit full booking path\n");

  console.log("## Same-turn tool chain coverage\n");
  const chainCases: Array<{ task: string; mustInclude: string[] }> = [
    {
      task: "CollectBookingFieldsTask",
      mustInclude: ["record_current_field", "check_availability"],
    },
    {
      task: "CheckAvailabilityTask",
      mustInclude: ["check_availability", "select_slot"],
    },
    {
      task: "SelectSlotTask",
      mustInclude: ["select_slot", "confirm_booking"],
    },
    {
      task: "ConfirmBookingTask",
      mustInclude: ["confirm_booking", "end_call"],
    },
  ];
  for (const row of chainCases) {
    const chained = new Set(toolsForTaskWithChain(row.task));
    for (const tool of row.mustInclude) {
      check(`${row.task} chain includes ${tool}`, chained.has(tool), [...chained].join(", "));
    }
  }

  check(
    "3-hop chain: availability turn includes confirm_booking",
    toolsForTaskWithChain("CheckAvailabilityTask").includes("confirm_booking"),
    toolsForTaskWithChain("CheckAvailabilityTask").join(", "),
  );

  console.log("\n## Live domain path\n");

  const ctx = await createPreprodTenant();
  try {
    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
      livekitRoomName: "full-booking-path",
    });
    ctx.callIds.push(callId);

    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      fromE164: "+14155550123",
      toE164: ctx.toE164,
    });

    await collectAllFields(callContext);
    check("fields complete", callContext.session.missingFieldIds.length === 0);
    check(
      "state after fields",
      callContext.session.currentState === "CHECKING_AVAILABILITY",
      callContext.session.currentState,
    );

    const avail = await domainCheckAvailability({
      ctx: callContext,
      spoken: "tomorrow afternoon",
    });
    check("check_availability ok", avail.ok !== false, avail.error_code);
    check(
      "slots returned",
      (callContext.session.availableSlots.length > 0) ||
        ((avail.data?.slots as unknown[] | undefined)?.length || 0) > 0,
    );
    check(
      "state after availability",
      callContext.session.currentState === "SELECTING_SLOT",
      callContext.session.currentState,
    );

    const select = await domainSelectSlot({
      ctx: callContext,
      utterance: "the first one",
    });
    check("select_slot ok", select.ok !== false, select.error_code);
    check(
      "held slot on session",
      Boolean(callContext.session.heldSlot || callContext.session.selectedSlot),
    );
    check(
      "state after slot selection",
      callContext.session.currentState === "READY_TO_BOOK" ||
        callContext.session.currentState === "BOOKING_IN_PROGRESS",
      callContext.session.currentState,
    );

    const confirm = await domainConfirmBooking({
      ctx: callContext,
      confirmed: true,
    });
    check("confirm_booking ok", confirm.ok === true, confirm.error_code);
    check(
      "state after confirm",
      callContext.session.currentState === "COMPLETE" ||
        Boolean(callContext.session.bookingId),
      callContext.session.currentState,
    );

    const appt = await getPrisma().voiceAppointment.findFirst({
      where: { callId },
      select: { id: true, status: true, startsAt: true, externalId: true },
    });
    check("voiceAppointment row created", Boolean(appt?.id), JSON.stringify(appt));
    check(
      "appointment status confirmed",
      appt?.status === "CONFIRMED" || appt?.status === "confirmed",
      appt?.status,
    );

    const call = await getPrisma().voiceCall.findUnique({
      where: { id: callId },
      select: { appointmentBooked: true, metadata: true },
    });
    check("call marked appointmentBooked", call?.appointmentBooked === true);

    await liveKitRuntimeProvider.endSession(callId);
  } finally {
    await cleanupPreprodTenant(ctx);
  }

  console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
  if (failures.length) {
    failures.forEach((f) => console.error(" -", f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
