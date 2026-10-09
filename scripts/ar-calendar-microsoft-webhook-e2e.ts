/**
 * Production E2E: create Outlook event via Graph → wait for webhook → sync job → voiceAppointment.
 *
 *   eval "$(ssh coolify-server '...')"  # hydrate DATABASE_URL + OAuth from web container
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-microsoft-webhook-e2e.ts
 */
import { getPrisma } from "@/lib/db";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";
import {
  deleteMicrosoftEvent,
  getValidAccessToken,
  insertMicrosoftEvent,
  resolveImportCalendarIds,
  type CalendarConfig,
} from "@/lib/calendar/providers";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CONNECTION_ID =
  process.env.CONNECTION_ID?.trim() || "cmu1uq7f15s1o5s4f6c5b6a57";
const CLEANUP = process.env.CLEANUP !== "0";
const POLL_MS = Number(process.env.POLL_MS || "5000");
const MAX_POLLS = Number(process.env.MAX_POLLS || "48"); // ~4 min

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prisma = getPrisma();
  const marker = `TransovoWebhookE2E-${new Date().toISOString().slice(0, 19)}Z`;
  const startedAt = new Date();

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: CONNECTION_ID, workspaceId: WORKSPACE_ID, provider: "microsoft" },
  });
  if (!conn) throw new Error("Microsoft connection not found");

  const config = (conn.config || {}) as CalendarConfig;
  const sub = await ensureMicrosoftCalendarSubscription(WORKSPACE_ID, CONNECTION_ID);
  console.log("[e2e] subscription", sub);

  const token = await getValidAccessToken(CONNECTION_ID, "microsoft", config);
  if (!token) throw new Error("No valid Microsoft access token");

  const importIds = resolveImportCalendarIds(config);
  const calendarId = importIds[0];
  console.log("[e2e] import calendar id", calendarId || "(default me/events)");

  const start = new Date(Date.now() + 8 * 24 * 3600_000);
  start.setUTCHours(15, 30, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);

  const ctx = { connectionId: CONNECTION_ID, config };
  const createStarted = Date.now();
  const graphEventId = await insertMicrosoftEvent(
    token,
    {
      summary: marker,
      description: "Automated Transovo webhook E2E — safe to delete",
      start,
      end,
      timezone: "America/New_York",
      calendarId,
    },
    ctx,
  );
  if (!graphEventId) throw new Error("Graph did not return event id");
  console.log("[e2e] created Graph event", { graphEventId, marker, start: start.toISOString() });

  let sawWebhook = false;
  let jobStatus: string | null = null;
  let appointmentId: string | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);

    const webhook = await prisma.providerWebhookEvent.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        provider: "microsoft",
        eventType: "calendar_change",
        createdAt: { gte: startedAt },
      },
      orderBy: { createdAt: "desc" },
    });
    sawWebhook = Boolean(webhook);

    const job = await prisma.jobQueue.findFirst({
      where: {
        jobType: "calendar_connection_sync",
        createdAt: { gte: startedAt },
        payload: { path: ["connectionId"], equals: CONNECTION_ID },
      },
      orderBy: { createdAt: "desc" },
    });
    jobStatus = job?.status ?? null;

    const appt = await prisma.voiceAppointment.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        serviceName: marker,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, startsAt: true, metadata: true, externalId: true },
    });
    appointmentId = appt?.id ?? null;

    console.log(
      `[e2e] poll ${i + 1}/${MAX_POLLS}`,
      JSON.stringify({
        sawWebhook,
        webhookAt: webhook?.createdAt?.toISOString(),
        jobStatus,
        appointmentId,
        reminderSmsEligible: (appt?.metadata as { reminderSmsEligible?: boolean })
          ?.reminderSmsEligible,
      }),
    );

    if (appointmentId) break;
    if (sawWebhook && jobStatus === "completed" && appointmentId) break;
  }

  const success = Boolean(appointmentId);
  const elapsedMs = Date.now() - createStarted;
  console.log(
    "\n[e2e] RESULT",
    success ? "PASS" : "FAIL",
    JSON.stringify({
      sawWebhook,
      jobStatus,
      appointmentId,
      marker,
      graphEventId,
      elapsedMs,
      targetMs: 8000,
    }),
  );

  if (CLEANUP && graphEventId) {
    try {
      await deleteMicrosoftEvent(token, graphEventId, ctx);
      console.log("[e2e] cleaned up Graph event", graphEventId);
    } catch (err) {
      console.warn("[e2e] cleanup failed (delete event manually):", err);
    }
  }

  if (!success) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
