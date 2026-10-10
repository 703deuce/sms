/**
 * Ops: why did reminder dispatch fail for one appointment?
 * APPT_ID=... WORKSPACE_ID=ws_1 npx tsx scripts/ar-prod-diagnose-appointment-send.ts
 */
import { getPrisma } from "@/lib/db";
import { evaluateSmsReminderEligibility } from "@/lib/appointment-reminders/sms-eligibility";
import { selectArOutboundPlatformSender } from "@/lib/appointment-reminders/messaging/reply-session";
import {
  configuredReminderSteps,
  trySendStepForDispatch,
} from "@/lib/appointments/reminder-delivery";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { reserveArReminderSmsUnit } from "@/lib/appointment-reminders/ar-sms-usage";
import { wasReminderSent } from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { shouldSkipReminderStepForConfirmation } from "@/lib/appointment-reminders/reminder-confirmation-guard";

const APPT_ID = process.env.APPT_ID?.trim() || "";
const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  if (!APPT_ID) {
    console.error("APPT_ID required");
    process.exit(1);
  }
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({ where: { id: APPT_ID, workspaceId: WORKSPACE_ID } });
  if (!row) {
    console.log(JSON.stringify({ error: "not_found" }));
    process.exit(1);
  }
  const meta = (row.metadata || {}) as AppointmentMetadata;
  const contact = row.contactId
    ? await prisma.contact.findFirst({ where: { id: row.contactId } })
    : null;
  const phone = meta.inviteePhone || contact?.phone || "";
  const sms = evaluateSmsReminderEligibility({
    metadata: meta,
    inviteePhone: meta.inviteePhone,
    contactPhone: contact?.phone,
    appointmentStatus: row.status,
  });
  const sel = phone
    ? await selectArOutboundPlatformSender({
        workspaceId: WORKSPACE_ID,
        appointmentId: APPT_ID,
        consumerE164: phone,
      })
    : null;
  const dispatches = await prisma.arReminderDispatch.findMany({
    where: { appointmentId: APPT_ID },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const sessions = row.contactId
    ? await prisma.arSmsReplySession.findMany({
        where: { contactId: row.contactId },
        orderBy: { lastUsedAt: "desc" },
        take: 8,
        select: {
          id: true,
          appointmentId: true,
          lifecycleState: true,
          platformPhoneNumberId: true,
          timelineType: true,
          lastUsedAt: true,
        },
      })
    : [];
  const platform = await loadAppointmentPlatformConfig(WORKSPACE_ID);
  const timeline = "reminder_120m_sent";
  const scheduled = configuredReminderSteps(platform).find((s) => s.timelineType === timeline);
  const reservation = await reserveArReminderSmsUnit({
    workspaceId: WORKSPACE_ID,
    appointmentId: APPT_ID,
    timelineType: timeline,
  });
  const skipConfirm = scheduled
    ? shouldSkipReminderStepForConfirmation({
        stepKey: scheduled.key,
        step: scheduled.step,
        appointmentStatus: row.status,
        metadata: meta,
        platform,
      })
    : null;
  console.log(
    JSON.stringify(
      {
        appointmentId: APPT_ID,
        startsAt: row.startsAt,
        contactId: row.contactId,
        phone,
        smsEligibility: sms,
        platformSender: sel,
        was2hSent: wasReminderSent(meta, timeline),
        step: scheduled
          ? { key: scheduled.key, enabled: scheduled.step.enabled, channel: scheduled.step.channel }
          : null,
        skipConfirm,
        reservation,
        arSmsReservations: meta.arSmsReservations,
        remindersSent: meta.remindersSent,
        reminderFailures: meta.reminderFailures,
        reminderAllowanceBlocks: meta.reminderAllowanceBlocks,
        sessions,
        dispatches,
      },
      null,
      2,
    ),
  );

  const failed = dispatches.find((d) => d.status === "failed");
  if (process.env.DIRECT_SEND === "1" && scheduled && phone && row.contactId) {
    const { executeArReminderDispatchJob } = await import(
      "@/lib/appointment-reminders/reminder-dispatch-executor"
    );
    const { sendArReminderSmsWithSession } = await import(
      "@/lib/appointment-reminders/messaging/outbound-reminder"
    );
    const ws = await prisma.workspace.findUnique({
      where: { id: WORKSPACE_ID },
      select: { displayName: true, name: true },
    });
    const pending = dispatches.find((d) => d.timelineType === timeline);
    if (pending) {
      await prisma.arReminderDispatch.update({
        where: { id: pending.id },
        data: {
          status: "pending",
          lastError: null,
          claimedAt: null,
          claimExpiresAt: null,
          submittingAt: null,
        },
      });
      const exec = await executeArReminderDispatchJob({ dispatchId: pending.id });
      console.log(JSON.stringify({ directDispatch: exec }, null, 2));
    }
  }

  if (failed && process.env.RETRY_DISPATCH === "1") {
    await prisma.arReminderDispatch.update({
      where: { id: failed.id },
      data: { status: "pending", lastError: null, claimExpiresAt: null },
    });
    const stepKey = String((failed.metadata as { stepKey?: string })?.stepKey || "reminder2h");
    const result = await trySendStepForDispatch({
      dispatchId: failed.id,
      workspaceId: WORKSPACE_ID,
      appointmentId: APPT_ID,
      timelineType: failed.timelineType,
      stepKey,
    });
    console.log(JSON.stringify({ retry: result }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
