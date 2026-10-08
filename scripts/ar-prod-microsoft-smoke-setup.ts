/**
 * Production: real Microsoft Graph event + Transovo appointment + live reminder SMS (C/R/X).
 *
 * Run in production web container:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-microsoft-smoke-setup.ts
 *
 * Env:
 *   WORKSPACE_ID=ws_1
 *   EMAIL=whywriteit@gmail.com
 *   PHONE=+15714776175
 *   MS_CONNECTION_ID=<optional — defaults to newest connected Microsoft connection>
 *   DAYS_AHEAD=4  (appointment start, local business TZ)
 *   SLOT_HOUR=10  SLOT_MINUTE=0
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { maybeSendImmediateConfirmationForAppointment } from "../src/lib/appointments/reminder-delivery";
import { resolveAppointmentOutboundSmsRoute } from "../src/lib/appointments/sms-sender";
import {
  resolveAiReschedulerConfig,
  isAiReschedulerSmsEnabled,
} from "../src/lib/appointment-reminders/ai-rescheduler/types";
import { loadAppointmentPlatformConfig } from "../src/lib/appointments/settings";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { formatImportedExternalId } from "../src/lib/calendar/external-id";
import { upsertWorkspaceAppointmentByExternalId } from "../src/lib/appointments/domain";
import { resetAppointmentReminders } from "../src/lib/appointments/reminder-state";
import { createId } from "../src/lib/supabase/id";
import type { CalendarConfig } from "../src/lib/calendar/providers";
import { resolveWriteCalendarId, getValidAccessToken } from "../src/lib/calendar/providers";
import { executeMicrosoftCreateBooking } from "../src/lib/voice-v3/calendar/microsoft/microsoft-create-booking";
import { wallTimeInZoneToUtc } from "../src/lib/voice-v3/time/timezone";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const EMAIL = (process.env.EMAIL || "whywriteit@gmail.com").toLowerCase();
const PHONE_RAW = process.env.PHONE || "+15714776175";
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD || "4");
const SLOT_HOUR = Number(process.env.SLOT_HOUR || "10");
const SLOT_MINUTE = Number(process.env.SLOT_MINUTE || "0");

function slotDaysAhead(days: number, hour: number, minute: number, timezone: string) {
  const probe = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(probe);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const start = wallTimeInZoneToUtc(timezone, y, m, d, hour, minute);
  const end = new Date(start.getTime() + 30 * 60_000);
  return { start, end };
}

async function ensureMicrosoftWriteCalendar(
  workspaceId: string,
  connectionId: string,
): Promise<{ calendarConfig: CalendarConfig; calendarId: string; timezone: string }> {
  const prisma = getPrisma();
  const { listConnectionProviderCalendars, patchWorkspaceCalendarConnection } = await import(
    "../src/lib/calendar/connection-settings"
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
  assert.ok(
    graphToken,
    `Microsoft Graph token required (connection status=${status}). Reconnect Microsoft in Appointments settings if needed.`,
  );

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
    console.log("configured_microsoft_write_calendar", writable.id);
  }

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const timezone = platform.timezone || calendarConfig.timezone || "America/New_York";
  const calendarId = resolveWriteCalendarId(calendarConfig);

  return { calendarConfig, calendarId, timezone };
}

async function main() {
  const phone = normalizeE164(PHONE_RAW);
  const prisma = getPrisma();

  const user = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${EMAIL}`);

  const member = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: WORKSPACE_ID },
    select: { workspaceId: true },
  });
  if (!member) {
    const any = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!any) throw new Error("No workspace membership");
    console.warn("Using workspace", any.workspaceId, "instead of", WORKSPACE_ID);
  }
  const workspaceId = member?.workspaceId || WORKSPACE_ID;

  const msConn = await prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId,
      provider: "microsoft",
      status: { in: ["connected", "needs_reauth"] },
      ...(process.env.MS_CONNECTION_ID?.trim()
        ? { id: process.env.MS_CONNECTION_ID.trim() }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, provider: true },
  });
  if (!msConn) {
    const all = await prisma.voiceCalendarConnection.findMany({
      where: { workspaceId },
      select: { id: true, provider: true, status: true, name: true },
    });
    console.error("No Microsoft calendar connection. Connections:", all);
    process.exit(1);
  }
  console.log("microsoft_connection", msConn);

  const { loadAppointmentRemindersActivation } = await import(
    "../src/lib/appointment-reminders/activation"
  );
  const activation = await loadAppointmentRemindersActivation(workspaceId);
  console.log("ar_activation", activation);

  const platformConfig = await loadAppointmentPlatformConfig(workspaceId);
  const arConfig = resolveAiReschedulerConfig(platformConfig);
  console.log("ai_rescheduler", arConfig);
  if (arConfig.mode !== "ai") {
    console.warn(
      "WARNING: aiRescheduler.mode is not 'ai' — reply R will not run the reschedule agent until mode is ai in Appointment Reminders settings.",
    );
  }

  const route = await resolveAppointmentOutboundSmsRoute(workspaceId);
  if (!route) {
    console.error(
      "No platform SMS route — reminders would fall back to workspace business line. Fix MCTB platform sender before live test.",
    );
    process.exit(1);
  }
  console.log("platform_sms_route", {
    fromE164: route.fromE164,
    sendWorkspaceId: route.sendWorkspaceId,
  });
  if (!isAiReschedulerSmsEnabled(arConfig)) {
    console.error("AI rescheduler SMS copy (C/R/X) is disabled in platform config.");
    process.exit(1);
  }

  let contact = await prisma.contact.findFirst({
    where: { workspaceId, phone },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        phone,
        email: user.email,
        firstName: "Live",
        lastName: "AR test",
      },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  const inviteeName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || "Guest";
  const serviceName = "Microsoft AR live test";

  const { calendarConfig, calendarId, timezone } = await ensureMicrosoftWriteCalendar(
    workspaceId,
    msConn.id,
  );
  const slot = slotDaysAhead(DAYS_AHEAD, SLOT_HOUR, SLOT_MINUTE, timezone);
  const bookingAttemptId = `ar_prod_manual_${Date.now()}`;

  console.log("creating_microsoft_graph_event", {
    calendarId,
    startsAt: slot.start.toISOString(),
    endsAt: slot.end.toISOString(),
    timezone,
  });

  const created = await executeMicrosoftCreateBooking({
    connectionId: msConn.id,
    calendarConfig,
    request: {
      callId: `ar_prod_${createId()}`,
      bookingAttemptId,
      schedulingGeneration: 1,
      offerSetId: "ar_prod_manual",
      slotId: "ar_prod_manual_slot",
      calendarId,
      startUtc: slot.start.toISOString(),
      endUtc: slot.end.toISOString(),
      timezone,
      customer: {
        name: inviteeName,
        phone,
        email: user.email,
      },
      service: {
        id: "ar_prod_manual",
        name: serviceName,
        durationMinutes: 30,
      },
    },
  });

  if (!created.ok) {
    console.error("microsoft_create_failed", created);
    process.exit(1);
  }

  const externalId = formatImportedExternalId("microsoft", msConn.id, created.providerEventId);
  const meta = resetAppointmentReminders({
    smsConsent: true,
    smsConsentAt: new Date().toISOString(),
    inviteePhone: phone,
    inviteeEmail: user.email,
    inviteeName,
    source: "calendar_import",
    provider: "microsoft",
    connectionId: msConn.id,
    providerEventId: created.providerEventId,
    calendarId: created.providerCalendarId || calendarId,
    timezone,
  });

  const row = await upsertWorkspaceAppointmentByExternalId({
    workspaceId,
    externalId,
    create: {
      contactId: contact.id,
      callId: null,
      serviceName,
      staffName: null,
      startsAt: slot.start,
      endsAt: slot.end,
      timezone,
      status: "scheduled",
      inviteePhone: phone,
      metadata: meta,
    },
    update: {
      contactId: contact.id,
      startsAt: slot.start,
      endsAt: slot.end,
      timezone,
      status: "scheduled",
      inviteePhone: phone,
      metadata: meta,
    },
  });

  console.log("appointment_linked", {
    appointmentId: row.id,
    externalId,
    providerEventId: created.providerEventId,
    providerCalendarId: created.providerCalendarId,
    startsAt: slot.start.toISOString(),
    workspaceId,
    phone,
  });

  const sendResult = await maybeSendImmediateConfirmationForAppointment(workspaceId, row.id);
  console.log("immediate_confirmation", sendResult);

  if (!sendResult.sent) {
    console.error(
      "Did not send production confirmation reminder. Fix skip reason above (activation, SMS consent, confirmation step, allowance, etc.).",
    );
    console.error(
      "Graph event was created — cancel manually in Outlook if you re-run after fixing SMS.",
      created.providerEventId,
    );
    process.exit(1);
  }

  console.log("\n--- Live manual test ---");
  console.log("Reply R to the platform SMS, then propose a new day/time.");
  console.log("After reschedule, verify:");
  console.log(
    `  WORKSPACE_ID=${workspaceId} APPT_ID=${row.id} PHONE=${phone} npx tsx scripts/ar-prod-inbound-debug.ts`,
  );
  console.log(
    `  npx tsx scripts/ar-prod-verify-reschedule.ts --appointment-id ${row.id}  (on prod container)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
