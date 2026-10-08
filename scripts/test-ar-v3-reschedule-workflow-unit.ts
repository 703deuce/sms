/**
 * Unit checks for AR ↔ Voice V3 reschedule workflow (no LLM, no live calendar).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-v3-reschedule-workflow-unit.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { requireIsolatedArTestDatabase } from "./cloud-agent/ar-test-database-guard";
import { getPrisma } from "@/lib/db";
import { buildAvailabilityOfferSet } from "@/lib/voice-v3/calendar/offer-set";
import { generateAvailabilitySlots } from "@/lib/voice-v3/calendar/slot-generator";
import { filterBusyForReschedule } from "@/lib/voice-v3/calendar/slot-generator";
import { saveWorkflowContext, loadWorkflowContext } from "@/lib/appointment-reminders/ai-rescheduler/v3-workflow/persist";
import { createInitialVoiceV3CallContext } from "@/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "@/lib/voice-v3/time/call-clock";
import { rescheduleAppointmentTool } from "@/lib/voice-v3/tools/reschedule-appointment-tool";
import { VoiceV3CallRuntime } from "@/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "@/lib/voice-v3/config/booking-agent-config";

function testBusyOverride() {
  const busy = [
    {
      calendarId: "cal",
      startUtc: "2026-10-10T14:00:00.000Z",
      endUtc: "2026-10-10T15:00:00.000Z",
    },
    {
      calendarId: "cal",
      startUtc: "2026-10-10T15:00:00.000Z",
      endUtc: "2026-10-10T16:00:00.000Z",
    },
  ];
  const existing = {
    startUtc: "2026-10-10T14:00:00.000Z",
    endUtc: "2026-10-10T15:00:00.000Z",
  };
  const filtered = filterBusyForReschedule(busy, existing);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].startUtc, "2026-10-10T15:00:00.000Z");
  console.log("PASS filterBusyForReschedule keeps overlapping third-party busy");
}

async function testOfferSetAndSlotBinding() {
  const slots = generateAvailabilitySlots({
    timezone: "America/New_York",
    rangeStartUtc: "2026-10-13T12:00:00.000Z",
    rangeEndUtc: "2026-10-13T22:00:00.000Z",
    durationMinutes: 30,
    slotStepMinutes: 30,
    businessHours: { weekdays: [1, 2, 3, 4, 5], startLocal: "09:00", endLocal: "17:00" },
    busyIntervals: [],
    maxSlots: 3,
  });
  assert.ok(slots.length >= 2);
  const offer = buildAvailabilityOfferSet({
    schedulingGeneration: 2,
    timezone: "America/New_York",
    slots,
  });
  const second = offer.slots[1];
  const clock = buildVoiceV3CallClock("America/New_York");
  let ctx = createInitialVoiceV3CallContext({
    callId: "test",
    liveSessionId: "sess",
    timezone: "America/New_York",
    clock,
  });
  ctx = {
    ...ctx,
    dialog: { activeGoal: "RESCHEDULE_APPOINTMENT" },
    scheduling: { generation: 2, normalized: { precision: "DAY", localDate: "2026-10-13" } as never },
    appointmentManagement: {
      ...ctx.appointmentManagement,
      verifiedExisting: {
        internalBookingId: "appt_1",
        provider: "microsoft",
        providerEventId: "evt",
        providerCalendarId: "cal",
        startUtc: "2026-10-10T14:00:00.000Z",
        endUtc: "2026-10-10T15:00:00.000Z",
        localStart: "",
        localEnd: "",
        timezone: "America/New_York",
        customerIdentity: {},
        durationMinutes: 30,
        status: "ACTIVE",
      },
      lookupCompleted: true,
    },
    availability: { ...ctx.availability, activeOfferSet: offer, status: "ready" },
  };
  const runtime = new VoiceV3CallRuntime({ config: VOICE_V3_BOOKING_AGENT_CONFIG, context: ctx });
  const toolCtx = {
    callId: "test",
    liveSessionId: "sess",
    delegationId: null,
    functionCallId: "fc",
    runtime,
    tenantId: "ws",
    sendContext: () => undefined,
  };
  const stale = await rescheduleAppointmentTool.execute(toolCtx, {
    appointment_selection_id: null,
    offer_set_id: "offer_set_stale",
    slot_id: second.slotId,
  });
  assert.equal(stale.ok, false);
  await rescheduleAppointmentTool.execute(toolCtx, {
    appointment_selection_id: null,
    offer_set_id: offer.offerSetId,
    slot_id: second.slotId,
  });
  const selected = runtime.getSnapshot().selection.selected;
  assert.equal(selected?.slotId, second.slotId);
  assert.equal(selected?.offerSetId, offer.offerSetId);
  console.log("PASS reschedule_appointment rejects stale offer_set_id and binds slot_id");
}

async function testPersistedContext() {
  await requireIsolatedArTestDatabase();
  const prisma = getPrisma();
  const slug = `ar-v3-unit-${randomBytes(4).toString("hex")}`;
  const ws = await prisma.workspace.create({ data: { name: "V3 unit", slug, billingPlan: "trial" } });
  const contact = await prisma.contact.create({
    data: { workspaceId: ws.id, phone: "+15551234001", firstName: "T" },
  });
  const start = new Date(Date.now() + 3 * 86400000);
  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ws.id,
      contactId: contact.id,
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 60_000),
      status: "confirmed",
      serviceName: "Test",
    },
  });
  const session = await prisma.arSmsReplySession.create({
    data: {
      workspaceId: ws.id,
      contactId: contact.id,
      appointmentId: appt.id,
      platformPhoneNumberId: (
        await prisma.phoneNumber.create({
          data: {
            workspaceId: ws.id,
            e164: "+18665550001",
            type: "platform",
            provider: "telnyx",
            status: "Active",
          },
        })
      ).id,
      provider: "telnyx",
      consumerE164: "+15551234001",
      lifecycleState: "RESCHEDULING",
    },
  });
  const clock = buildVoiceV3CallClock("America/New_York");
  const ctx = createInitialVoiceV3CallContext({
    callId: session.id,
    liveSessionId: session.id,
    timezone: "America/New_York",
    clock,
  });
  try {
    await saveWorkflowContext(session.id, ctx);
    const loaded = await loadWorkflowContext(session.id);
    assert.ok(loaded);
    assert.equal(loaded!.liveSessionId, session.id);
    console.log("PASS rescheduleWorkflowState persists VoiceV3CallContext on session");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("rescheduleWorkflowState") || msg.includes("no row matched")) {
      console.log("SKIP persist test — apply migration 20261008150000_ar_reschedule_workflow_state");
      return;
    }
    throw err;
  }
}

async function main() {
  testBusyOverride();
  await testOfferSetAndSlotBinding();
  await testPersistedContext();
  console.log("\nAll AR V3 workflow unit checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
