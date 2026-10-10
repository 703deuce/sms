/**
 * End-to-end live test: real Microsoft Graph event + Transovo appointment + reminder2h dispatch.
 *
 *   WORKSPACE_ID=ws_1 PHONE=+15714776175 EMAIL=whywriteit@gmail.com \
 *   AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS=1 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/ar-prod-microsoft-2h-reminder-live.ts
 *
 * Optional: MS_CONNECTION_ID=...  MINUTES_BEFORE=120  SKIP_IMMEDIATE_CONFIRMATION=1 (default)
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { discoverAndEnqueueDueAppointmentReminders } from "@/lib/appointment-reminders/reminder-discovery";
import { executeArReminderDispatchJob } from "@/lib/appointment-reminders/reminder-dispatch-executor";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveStepFireTime, configuredReminderSteps } from "@/lib/appointments/reminder-delivery";
import { reminderTimelineType, markReminderSentInMeta, resetAppointmentReminders } from "@/lib/appointments/reminder-state";
import { upsertWorkspaceAppointmentByExternalId } from "@/lib/appointments/domain";
import { formatImportedExternalId } from "@/lib/calendar/external-id";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { resolveWriteCalendarId, getValidAccessToken } from "@/lib/calendar/providers";
import { executeMicrosoftCreateBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-create-booking";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { createId } from "@/lib/supabase/id";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import { platformMctbSenderSuppressionKey } from "@/lib/mctb/messaging/platform-sender-suppression";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "@/lib/mctb/messaging/caller-e164";
import { AR_REPLY_ELIGIBLE_STATES } from "@/lib/appointment-reminders/messaging/ar-platform-sender-pool";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const PHONE_RAW = process.env.PHONE?.trim() || process.env.AR_LIVE_CUSTOMER_E164?.trim() || "";
const EMAIL = (process.env.EMAIL || "whywriteit@gmail.com").toLowerCase();
const MINUTES_BEFORE = Number(process.env.MINUTES_BEFORE || "120");
const SKIP_IMMEDIATE_CONFIRMATION = process.env.SKIP_IMMEDIATE_CONFIRMATION !== "0";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureMicrosoftWriteCalendar(
  workspaceId: string,
  connectionId: string,
): Promise<{ calendarConfig: CalendarConfig; calendarId: string; timezone: string }> {
  const prisma = getPrisma();
  const { listConnectionProviderCalendars, patchWorkspaceCalendarConnection } = await import(
    "@/lib/calendar/connection-settings"
  );

  let conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
  });
  assert.ok(conn, `Microsoft connection not found: ${connectionId}`);

  let calendarConfig = (conn.config || {}) as CalendarConfig;
  const status = String(conn.status || "");
  const graphToken = await getValidAccessToken(connectionId, "microsoft", calendarConfig, {
    forceRefresh: status === "needs_reauth",
    mutationSource: "production_web",
  });
  assert.ok(graphToken, `Microsoft Graph token required (connection status=${status})`);

  if (!calendarConfig.writeCalendarId) {
    const calendars = await listConnectionProviderCalendars(workspaceId, connectionId);
    const writable = calendars.find((c) => c.canEdit !== false) || calendars[0];
    assert.ok(writable?.id, "Microsoft connection has no writable calendar");
    await patchWorkspaceCalendarConnection(workspaceId, connectionId, {
      writeCalendarId: writable.id,
      blockingCalendarIds: [writable.id],
      importCalendarIds: [writable.id],
      syncEnabled: true,
    });
    conn = await prisma.voiceCalendarConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });
    calendarConfig = (conn?.config || {}) as CalendarConfig;
  }

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const timezone = platform.timezone || calendarConfig.timezone || "America/New_York";
  const calendarId = resolveWriteCalendarId(calendarConfig);
  return { calendarConfig, calendarId, timezone };
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
  return { ok: true, deleted: removed.count };
}

async function main() {
  if (!PHONE_RAW) {
    console.error("Set PHONE=+1...");
    process.exit(1);
  }
  const phone = normalizeE164(PHONE_RAW);
  const prisma = getPrisma();

  const msConn = await prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      provider: "microsoft",
      status: { in: ["connected", "needs_reauth"] },
      ...(process.env.MS_CONNECTION_ID?.trim() ? { id: process.env.MS_CONNECTION_ID.trim() } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true },
  });
  if (!msConn) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "no_microsoft_connection" }));
    process.exit(1);
  }

  let contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: WORKSPACE_ID,
        phone,
        email: EMAIL,
        firstName: "Anthony",
        lastName: "Live",
        status: "SUBSCRIBED",
      },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  const inviteeName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || "Guest";
  const serviceName = process.env.SERVICE_NAME?.trim() || "Follow-up visit";

  const { calendarConfig, calendarId, timezone } = await ensureMicrosoftWriteCalendar(
    WORKSPACE_ID,
    msConn.id,
  );

  const startsAt = new Date(Date.now() + MINUTES_BEFORE * 60_000 + 45_000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

  const created = await executeMicrosoftCreateBooking({
    connectionId: msConn.id,
    calendarConfig,
    request: {
      callId: `ar_2h_${createId()}`,
      bookingAttemptId: `ar_2h_${Date.now()}`,
      schedulingGeneration: 1,
      offerSetId: "ar_2h_live",
      slotId: "ar_2h_live_slot",
      calendarId,
      startUtc: startsAt.toISOString(),
      endUtc: endsAt.toISOString(),
      timezone,
      customer: { name: inviteeName, phone, email: EMAIL },
      service: { id: "ar_2h_live", name: serviceName, durationMinutes: 30 },
    },
  });

  if (!created.ok) {
    console.log(JSON.stringify({ status: "FAIL", step: "microsoft_create", detail: created }));
    process.exit(1);
  }

  const externalId = formatImportedExternalId("microsoft", msConn.id, created.providerEventId);
  let meta = resetAppointmentReminders({
    smsConsent: true,
    smsConsentAt: new Date().toISOString(),
    reminderSmsEligible: true,
    inviteePhone: phone,
    inviteeEmail: EMAIL,
    inviteeName,
    source: "calendar_import",
    provider: "microsoft",
    connectionId: msConn.id,
    providerEventId: created.providerEventId,
    calendarId: created.providerCalendarId || calendarId,
    timezone,
    bookingSource: "ar_microsoft_2h_live",
  });
  if (SKIP_IMMEDIATE_CONFIRMATION) {
    meta = markReminderSentInMeta(meta, reminderTimelineType("confirmation"));
  }

  const row = await upsertWorkspaceAppointmentByExternalId({
    workspaceId: WORKSPACE_ID,
    externalId,
    create: {
      contactId: contact.id,
      callId: null,
      serviceName,
      staffName: null,
      startsAt,
      endsAt,
      timezone,
      status: "scheduled",
      inviteePhone: phone,
      metadata: meta,
    },
    update: {
      contactId: contact.id,
      startsAt,
      endsAt,
      timezone,
      status: "scheduled",
      inviteePhone: phone,
      metadata: meta,
    },
  });

  const consumerVariants = mctbCallerE164Variants(normalizeMctbCallerE164(phone));
  await prisma.arSmsReplySession.updateMany({
    where: {
      workspaceId: WORKSPACE_ID,
      consumerE164: { in: consumerVariants },
      lifecycleState: { in: [...AR_REPLY_ELIGIBLE_STATES] },
    },
    data: { lifecycleState: "EXPIRED", completedAt: new Date(), lastUsedAt: new Date() },
  });

  const optOut = await clearPlatformOptOut(phone);

  const platform = await loadAppointmentPlatformConfig(WORKSPACE_ID);
  const twoHourStep = platform.reminders.reminder2h;
  const minutesBefore = twoHourStep.minutesBefore || MINUTES_BEFORE;
  const fireAt = resolveStepFireTime(twoHourStep, startsAt);
  const twoHourTimeline = reminderTimelineType("reminder2h", minutesBefore);

  process.env.AR_REMINDER_DISCOVERY_TEST_WORKSPACE = WORKSPACE_ID;
  process.env.AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS =
    process.env.AR_REMINDER_DISCOVERY_BYPASS_QUIET_HOURS || "1";
  process.env.AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE = "1";

  let discovery = { examined: 0, due: 0, enqueued: 0, suppressedLate: 0 };
  for (let i = 0; i < 12; i++) {
    discovery = await discoverAndEnqueueDueAppointmentReminders();
    if (discovery.enqueued > 0) break;
    await sleep(400);
  }

  const dispatch = await prisma.arReminderDispatch.findFirst({
    where: { appointmentId: row.id, timelineType: twoHourTimeline },
    orderBy: { createdAt: "desc" },
  });

  if (!dispatch) {
    console.log(
      JSON.stringify(
        {
          status: "FAIL",
          reason: "no_reminder2h_dispatch",
          appointmentId: row.id,
          externalId,
          providerEventId: created.providerEventId,
          startsAt: startsAt.toISOString(),
          fireAt: fireAt.toISOString(),
          discovery,
          optOut,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const first = await executeArReminderDispatchJob({ dispatchId: dispatch.id });
  let finalRow = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  for (let i = 0; i < 35 && finalRow && !["delivered", "sent", "accepted"].includes(finalRow.status); i++) {
    await sleep(2000);
    finalRow = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  }

  const { providerRefFromAppointment } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/provider-mutations"
  );
  const verifyRow = await prisma.voiceAppointment.findFirst({ where: { id: row.id } });
  const providerRef = verifyRow ? providerRefFromAppointment(verifyRow) : null;

  console.log(
    JSON.stringify(
      {
        status: first.ok ? "PASS" : "FAIL",
        appointmentId: row.id,
        microsoft: {
          connectionId: msConn.id,
          providerEventId: created.providerEventId,
          providerCalendarId: created.providerCalendarId || calendarId,
        },
        providerRefOk: Boolean(providerRef),
        startsAt: startsAt.toISOString(),
        reminder2hFireAt: fireAt.toISOString(),
        optOut,
        discovery,
        dispatch: first,
        dispatchRow: finalRow,
        next: "Reply R on SMS — reschedule should verify against Microsoft Graph",
      },
      null,
      2,
    ),
  );

  if (!first.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
