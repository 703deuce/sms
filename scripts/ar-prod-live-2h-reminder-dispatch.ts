/**
 * Live ops: real appointment ~2h out → discovery enqueues reminder2h → dispatch sends SMS (C/R/X).
 *
 * Bypasses quiet-hours skip in discovery only when AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS=1.
 * Does not delete the appointment unless CLEANUP=1.
 *
 *   WORKSPACE_ID=ws_1 PHONE=+15714776175 \
 *   AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS=1 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/ar-prod-live-2h-reminder-dispatch.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { createManualArAppointment } from "@/lib/appointment-reminders/ar-manual-appointments";
import { discoverAndEnqueueDueAppointmentReminders } from "@/lib/appointment-reminders/reminder-discovery";
import { executeArReminderDispatchJob } from "@/lib/appointment-reminders/reminder-dispatch-executor";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveStepFireTime, configuredReminderSteps } from "@/lib/appointments/reminder-delivery";
import { reminderTimelineType, markReminderSentInMeta } from "@/lib/appointments/reminder-state";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { platformMctbSenderSuppressionKey } from "@/lib/mctb/messaging/platform-sender-suppression";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const PHONE = process.env.PHONE?.trim() || process.env.AR_LIVE_CUSTOMER_E164?.trim() || "";
const CLEANUP = process.env.CLEANUP === "1";
const SKIP_CONFIRMATION_MARK_SENT = process.env.SKIP_CONFIRMATION_MARK_SENT !== "0";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clearPlatformOptOut(phone: string) {
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform) return { ok: false, deleted: 0 };
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(phone);
  const suppressionKey = platformMctbSenderSuppressionKey(platform.phoneNumberId, phone);
  const removed = await prisma.suppression.deleteMany({
    where: {
      OR: [
        { suppressionKey },
        { workspaceId: platform.workspaceId, phone: { in: variants }, reason: { in: ["STOP", "OPT_OUT"] } },
        { workspaceId: WORKSPACE_ID, phone: { in: variants }, reason: { in: ["STOP", "OPT_OUT"] } },
      ],
    },
  });
  const contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: { in: variants } },
    select: { id: true, status: true },
  });
  if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "SUBSCRIBED" },
    });
  }
  return { ok: true, deleted: removed.count };
}

async function ensureContact(phone: string) {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(phone);
  let contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: { in: variants } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: WORKSPACE_ID,
        phone: normalizeMctbCallerE164(phone),
        firstName: "Anthony",
        lastName: "Live",
        status: "SUBSCRIBED",
      },
    });
  } else if (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED") {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "SUBSCRIBED" },
    });
  }
  return contact;
}

async function main() {
  if (!PHONE) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "Set PHONE or AR_LIVE_CUSTOMER_E164" }));
    process.exit(1);
  }

  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(WORKSPACE_ID);
  const twoHourStep = platform.reminders.reminder2h;
  if (!twoHourStep.enabled) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "reminder2h_disabled_on_workspace" }));
    process.exit(1);
  }
  const minutesBefore = twoHourStep.minutesBefore || 120;

  const optOut = await clearPlatformOptOut(PHONE);
  const contact = await ensureContact(PHONE);

  const startsAt = new Date(Date.now() + minutesBefore * 60_000 + 45_000);
  const row = await createManualArAppointment(WORKSPACE_ID, {
    inviteeName: "Anthony",
    inviteePhone: PHONE,
    serviceName: "Consultation",
    startsAt,
    timezone: platform.timezone || "America/New_York",
  });

  let meta: AppointmentMetadata = {
    ...(row.metadata as AppointmentMetadata),
    inviteePhone: normalizeMctbCallerE164(PHONE),
    reminderSmsEligible: true,
    smsConsent: true,
    smsConsentAt: new Date().toISOString(),
    source: "ar_live_2h_dispatch",
    bookingSource: "ar_manual",
  };
  if (SKIP_CONFIRMATION_MARK_SENT) {
    meta = markReminderSentInMeta(meta, reminderTimelineType("confirmation"));
  }

  await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: {
      contactId: contact.id,
      inviteePhone: normalizeMctbCallerE164(PHONE),
      metadata: meta as object,
    },
  });

  const fireAt = resolveStepFireTime(twoHourStep, startsAt);
  const twoHourTimeline = reminderTimelineType("reminder2h", minutesBefore);

  process.env.AR_REMINDER_DISCOVERY_TEST_WORKSPACE = WORKSPACE_ID;
  process.env.AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS =
    process.env.AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS || "1";
  // Run dispatch in-process so worker race does not claim the row first.
  process.env.AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE = "1";
  delete process.env.AR_REMINDER_DISPATCH_TEST_MOCK;

  let discovery = { examined: 0, due: 0, enqueued: 0, suppressedLate: 0 };
  for (let i = 0; i < 10; i++) {
    discovery = await discoverAndEnqueueDueAppointmentReminders();
    if (discovery.enqueued > 0) break;
    await sleep(400);
  }

  const dispatch = await prisma.arReminderDispatch.findFirst({
    where: { appointmentId: row.id, timelineType: twoHourTimeline },
    orderBy: { createdAt: "desc" },
  });

  if (!dispatch) {
    const steps = configuredReminderSteps(platform).filter((s) => !s.immediate);
    const schedule = steps.map((s) => ({
      key: s.key,
      fireAt: resolveStepFireTime(s.step, startsAt).toISOString(),
      timelineType: s.timelineType,
    }));
    console.log(
      JSON.stringify(
        {
          status: "FAIL",
          reason: "no_reminder2h_dispatch_row",
          appointmentId: row.id,
          startsAt: startsAt.toISOString(),
          expectedFireAt: fireAt.toISOString(),
          twoHourTimeline,
          discovery,
          optOut,
          schedule,
        },
        null,
        2,
      ),
    );
    if (!CLEANUP) {
      console.log(JSON.stringify({ note: "appointment_kept", appointmentId: row.id }));
    }
    process.exit(1);
  }

  const first = await executeArReminderDispatchJob({ dispatchId: dispatch.id });
  const second = await executeArReminderDispatchJob({ dispatchId: dispatch.id });

  let finalRow = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  for (let i = 0; i < 35 && finalRow && !["delivered", "sent", "accepted"].includes(finalRow.status); i++) {
    await sleep(2000);
    finalRow = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  }

  const outcome = {
    status: first.ok ? "PASS" : "FAIL",
    appointmentId: row.id,
    contactId: contact.id,
    phone: normalizeMctbCallerE164(PHONE),
    startsAt: startsAt.toISOString(),
    reminder2hFireAt: fireAt.toISOString(),
    minutesBefore,
    optOut,
    discovery,
    firstDispatch: first,
    duplicateDispatch: second,
    dispatchRow: finalRow
      ? {
          id: finalRow.id,
          timelineType: finalRow.timelineType,
          status: finalRow.status,
          telnyxMessageId: finalRow.telnyxMessageId,
          providerMessageId: finalRow.providerMessageId,
          lastError: finalRow.lastError,
        }
      : null,
    nextStep: "Reply R on this SMS to exercise AI reschedule",
    phoneDelivery: "MANUAL — confirm 2-hour reminder on device",
  };

  console.log(JSON.stringify(outcome, null, 2));

  if (CLEANUP) {
    await prisma.arReminderDispatch.deleteMany({ where: { appointmentId: row.id } }).catch(() => undefined);
    await prisma.voiceAppointment.delete({ where: { id: row.id } }).catch(() => undefined);
  }

  if (!first.ok) process.exit(1);
  assert.ok(
    finalRow?.telnyxMessageId || finalRow?.providerMessageId || first.sent,
    "expected provider message id or sent flag",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
