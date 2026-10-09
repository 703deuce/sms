/**
 * Telnyx delivery webhooks reconcile unknown AR dispatches without resubmitting SMS.
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { getOrCreateArScaleTestWorkspace } from "./lib/ar-scale-test-workspace";
import { reconcileArReminderDispatchFromTelnyxDelivery } from "../src/lib/appointment-reminders/ar-dispatch-telnyx-reconcile";
import { applyOutboundDeliveryStatus } from "../src/lib/messaging/delivery-status";

async function main() {
  const prisma = getPrisma();
  const workspaceId = await getOrCreateArScaleTestWorkspace();
  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId,
      serviceName: "Test",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      status: "scheduled",
      timezone: "America/New_York",
      metadata: { reminderGeneration: 1 },
    },
  });

  const providerId = `telnyx-test-${Date.now()}`;
  const dispatch = await prisma.arReminderDispatch.create({
    data: {
      workspaceId,
      appointmentId: appt.id,
      timelineType: "reminder_1440m_sent",
      reminderGeneration: 1,
      intendedFireAt: new Date(),
      status: "unknown",
      unknownSince: new Date(),
      telnyxMessageId: providerId,
      lastError: "timeout",
    },
  });

  const r1 = await reconcileArReminderDispatchFromTelnyxDelivery({
    providerMessageId: providerId,
    internalStatus: "sent",
  });
  assert.equal(r1.nextStatus, "sent");

  const rowAfterSent = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  assert.equal(rowAfterSent?.status, "sent");

  await applyOutboundDeliveryStatus({
    providerMessageId: providerId,
    status: "delivered",
    provider: "telnyx",
  });

  const rowAfterDelivered = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  assert.equal(rowAfterDelivered?.status, "delivered");

  const rDup = await reconcileArReminderDispatchFromTelnyxDelivery({
    providerMessageId: providerId,
    internalStatus: "sent",
  });
  assert.equal(rDup.nextStatus, "delivered");

  await prisma.arReminderDispatch.delete({ where: { id: dispatch.id } });
  await prisma.voiceAppointment.delete({ where: { id: appt.id } });

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
