/**
 * Live path the customer expects: Graph API appointment on connected Microsoft calendar
 * → calendar sync import → phone from title/body → automatic reminder SMS.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   PHONE=+15714776175 EMAIL=whywriteit@gmail.com \
 *   npx tsx scripts/ar-prod-microsoft-graph-appointment-live.ts
 */
import { getPrisma } from "@/lib/db";
import {
  getValidAccessToken,
  insertMicrosoftEvent,
  resolveImportCalendarIds,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CONNECTION_ID =
  process.env.CONNECTION_ID?.trim() || "cmu1uq7f15s1o5s4f6c5b6a57";
const PHONE = process.env.PHONE?.trim() || "+15714776175";
const EMAIL = (process.env.EMAIL || "whywriteit@gmail.com").toLowerCase();
const MINUTES_UNTIL_START = Number(process.env.MINUTES_UNTIL_START || "130");
const POLL_MS = Number(process.env.POLL_MS || "4000");
const MAX_POLLS = Number(process.env.MAX_POLLS || "40");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prisma = getPrisma();
  const runTag = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const marker = `Anthony AR API ${runTag}`;
  const subject = `${marker} - ${PHONE.replace(/\D/g, "").slice(-10)}`;
  const description = `Customer mobile: ${PHONE}\nAttendee: ${EMAIL}`;

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: CONNECTION_ID, workspaceId: WORKSPACE_ID, provider: "microsoft" },
  });
  if (!conn) throw new Error("Microsoft connection not found");

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(CONNECTION_ID, "microsoft", config, {
    mutationSource: "production_web",
  });
  if (!token) throw new Error("No valid Microsoft Graph token — reconnect calendar in Transovo");

  const platform = await loadAppointmentPlatformConfig(WORKSPACE_ID);
  const tz = platform.timezone || config.timezone || "America/New_York";
  const importIds = resolveImportCalendarIds(config);
  const calendarId = importIds[0];
  const ctx = { connectionId: CONNECTION_ID, config };

  const startsAt = new Date(Date.now() + MINUTES_UNTIL_START * 60_000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  const startedAt = new Date();

  console.log("[graph-live] creating event", {
    subject,
    startsAt: startsAt.toISOString(),
    calendarId: calendarId || "(default)",
    tz,
  });

  const graphEventId = await insertMicrosoftEvent(
    token,
    {
      summary: subject,
      description,
      start: startsAt,
      end: endsAt,
      timezone: tz,
      calendarId,
      attendees: [{ email: EMAIL, name: "Anthony" }],
    },
    ctx,
  );
  if (!graphEventId) throw new Error("Graph create returned no event id");
  console.log("[graph-live] graphEventId", graphEventId);

  const syncStats = await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, {
    incremental: true,
  });
  console.log("[graph-live] sync after create", syncStats);

  let appointmentId: string | null = null;
  let meta: AppointmentMetadata | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(i === 0 ? 2000 : POLL_MS);
    const appt = await prisma.voiceAppointment.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        OR: [
          { serviceName: subject },
          { serviceName: { contains: marker } },
          { externalId: { contains: graphEventId } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, serviceName: true, startsAt: true, metadata: true, inviteePhone: true },
    });
    if (appt) {
      appointmentId = appt.id;
      meta = (appt.metadata || {}) as AppointmentMetadata;
      console.log("[graph-live] imported appointment", {
        id: appt.id,
        serviceName: appt.serviceName,
        inviteePhone: appt.inviteePhone || meta.inviteePhone,
        reminderSmsEligible: meta.reminderSmsEligible,
        reminderImportEligible: meta.reminderImportEligible,
      });
      break;
    }
    if (i % 3 === 0) {
      await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, { incremental: true });
    }
    console.log(`[graph-live] waiting import poll ${i + 1}/${MAX_POLLS}`);
  }

  if (!appointmentId) {
    console.log(JSON.stringify({ status: "FAIL", reason: "appointment_not_imported", graphEventId }));
    process.exit(1);
  }

  const phoneDigits = PHONE.replace(/\D/g, "").slice(-10);
  let smsRow: { id: string; body: string; status: string; createdAt: Date } | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const rows = await prisma.message.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        createdAt: { gte: startedAt },
        OR: [{ to: { contains: phoneDigits } }, { to: PHONE }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, body: true, status: true, createdAt: true },
    });
    const arLike = rows.find(
      (m) =>
        /appointment|confirmed|reminder|Oct|PM|AM/i.test(m.body || "") &&
        !/google review|leave us a review/i.test(m.body || ""),
    );
    if (arLike) {
      smsRow = arLike;
      break;
    }
    if (rows[0] && i > 5) {
      smsRow = rows[0];
      break;
    }
    console.log(`[graph-live] waiting SMS poll ${i + 1}/${MAX_POLLS}`, rows.length);
  }

  const dispatches = await prisma.arReminderDispatch.findMany({
    where: { workspaceId: WORKSPACE_ID, appointmentId, createdAt: { gte: startedAt } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, timelineType: true, status: true, intendedFireAt: true, lastError: true },
  });

  console.log(
    JSON.stringify(
      {
        status: smsRow ? "PASS" : dispatches.length ? "PARTIAL_SMS_PENDING" : "FAIL_NO_SMS",
        graphEventId,
        appointmentId,
        parsedPhone: meta?.inviteePhone,
        dispatches,
        sms: smsRow
          ? {
              id: smsRow.id,
              status: smsRow.status,
              at: smsRow.createdAt.toISOString(),
              preview: smsRow.body?.slice(0, 120),
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (!smsRow && dispatches.length === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
