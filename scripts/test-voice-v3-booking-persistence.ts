/**
 * Voice V3 booking persistence — idempotency + VoiceCall flag (requires DATABASE_URL).
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { persistVoiceV3BookingAfterConfirmation } from "../src/lib/voice-v3/calendar/persist-booking-after-confirmation";
import type { ConfirmedBooking } from "../src/lib/voice-v3/calendar/booking-types";

const WORKSPACE = process.env.VOICE_V3_TEST_WORKSPACE_ID || "ws_1";

function confirmed(attempt: string, eventId: string): ConfirmedBooking {
  return {
    bookingAttemptId: attempt,
    provider: "microsoft",
    providerEventId: eventId,
    providerCalendarId: "cal_test",
    startUtc: "2026-10-01T17:00:00.000Z",
    endUtc: "2026-10-01T18:00:00.000Z",
    localStart: "2026-10-01T13:00:00-04:00",
    localEnd: "2026-10-01T14:00:00-04:00",
    timezone: "America/New_York",
    customerName: "Test Caller",
    serviceId: "svc_test",
    confirmedAt: new Date().toISOString(),
    offerSetId: "offer_test",
    slotId: "slot_test",
    schedulingGeneration: 1,
  };
}

async function main() {
  const prisma = getPrisma();
  const suffix = `persist_${Date.now()}`;
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: WORKSPACE,
      id: `lk_test_${suffix}`,
      status: "COMPLETED",
      appointmentBooked: false,
      fromE164: "+15550001111",
      toE164: "+15550002222",
      direction: "INBOUND",
      provider: "livekit",
    },
  });

  const booking = confirmed(`bka_${suffix}`, `evt_${suffix}`);
  const first = await persistVoiceV3BookingAfterConfirmation({
    workspaceId: WORKSPACE,
    callId: call.id,
    confirmed: booking,
    serviceName: "Plumbing visit",
    customerEmail: "test@example.com",
    customerPhone: "+15550001111",
  });
  assert.ok(first?.appointmentId);
  assert.equal(first.created, true);

  const row1 = await prisma.voiceAppointment.findUnique({ where: { id: first.appointmentId } });
  assert.ok(row1);
  assert.equal(row1.callId, call.id);
  assert.equal(row1.externalId, `microsoft:evt_${suffix}`);
  const meta = row1.metadata as Record<string, unknown>;
  assert.equal((meta.voiceV3 as Record<string, unknown>)?.bookingAttemptId, booking.bookingAttemptId);

  const callAfter = await prisma.voiceCall.findUnique({
    where: { id: call.id },
    select: { appointmentBooked: true },
  });
  assert.equal(callAfter?.appointmentBooked, true);

  const second = await persistVoiceV3BookingAfterConfirmation({
    workspaceId: WORKSPACE,
    callId: call.id,
    confirmed: booking,
    serviceName: "Plumbing visit",
    customerEmail: "test@example.com",
    customerPhone: "+15550001111",
  });
  assert.equal(second?.appointmentId, first.appointmentId);
  assert.equal(second?.created, false);

  const count = await prisma.voiceAppointment.count({
    where: { workspaceId: WORKSPACE, callId: call.id },
  });
  assert.equal(count, 1);

  await prisma.voiceAppointment.delete({ where: { id: first.appointmentId } }).catch(() => undefined);
  await prisma.voiceCall.delete({ where: { id: call.id } }).catch(() => undefined);

  console.log("VOICE_V3_BOOKING_PERSISTENCE: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
