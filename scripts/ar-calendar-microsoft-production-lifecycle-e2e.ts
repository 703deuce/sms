/**
 * Microsoft 365 production lifecycle verification (ws_1 test connection only).
 *
 *   npx tsx scripts/cloud-agent/hydrate-prod-test-env.ts  # if DATABASE_URL missing
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-microsoft-production-lifecycle-e2e.ts
 */
import { getPrisma } from "@/lib/db";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";
import {
  deleteMicrosoftEvent,
  getValidAccessToken,
  insertMicrosoftEvent,
  resolveImportCalendarIds,
  updateMicrosoftEvent,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CONNECTION_ID = process.env.CONNECTION_ID?.trim() || "cmu1uq7f15s1o5s4f6c5b6a57";
const CLEANUP = process.env.CLEANUP !== "0";
const POLL_MS = Number(process.env.POLL_MS || "4000");
const MAX_POLLS = Number(process.env.MAX_POLLS || "45");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type StepResult = { step: string; ok: boolean; detail?: unknown };

async function waitForAppointmentByMarker(
  marker: string,
  startedAt: Date,
): Promise<{ id: string; serviceName: string; startsAt: Date; status: string; externalId: string | null } | null> {
  const prisma = getPrisma();
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const appt = await prisma.voiceAppointment.findFirst({
      where: { workspaceId: WORKSPACE_ID, serviceName: marker },
      orderBy: { createdAt: "desc" },
      select: { id: true, serviceName: true, startsAt: true, status: true, externalId: true },
    });
    if (appt) return appt;
    const alt = await prisma.voiceAppointment.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        createdAt: { gte: startedAt },
        serviceName: { contains: marker.slice(0, 24) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, serviceName: true, startsAt: true, status: true, externalId: true },
    });
    if (alt?.serviceName === marker) return alt;
    console.log(`[lifecycle] wait marker=${marker.slice(0, 40)} poll ${i + 1}/${MAX_POLLS}`);
  }
  return null;
}

async function waitForAppointmentUpdate(
  appointmentId: string,
  predicate: (row: {
    serviceName: string;
    startsAt: Date;
    status: string;
    metadata: Record<string, unknown> | null;
  }) => boolean,
): Promise<boolean> {
  const prisma = getPrisma();
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const appt = await prisma.voiceAppointment.findUnique({
      where: { id: appointmentId },
      select: { serviceName: true, startsAt: true, status: true, metadata: true },
    });
    if (appt && predicate({ ...appt, metadata: (appt.metadata || {}) as Record<string, unknown> }))
      return true;
    if (i === 0 || i === MAX_POLLS - 1) {
      console.log(
        `[lifecycle] wait update ${appointmentId} poll ${i + 1}/${MAX_POLLS}`,
        appt ? { serviceName: appt.serviceName, startsAt: appt.startsAt, status: appt.status } : null,
      );
    }
  }
  return false;
}

async function main() {
  const prisma = getPrisma();
  const results: StepResult[] = [];
  const runTag = new Date().toISOString().slice(0, 19).replace(/[:]/g, "");
  const marker = `AR-M365-Lifecycle-${runTag}`;
  const markerRenamed = `${marker}-renamed`;
  const backstopMarker = `AR-M365-Backstop-${runTag}`;

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: CONNECTION_ID, workspaceId: WORKSPACE_ID, provider: "microsoft" },
  });
  if (!conn) throw new Error("Microsoft connection not found");

  const config = (conn.config || {}) as CalendarConfig;
  await ensureMicrosoftCalendarSubscription(WORKSPACE_ID, CONNECTION_ID);
  const token = await getValidAccessToken(CONNECTION_ID, "microsoft", config);
  if (!token) throw new Error("No valid Microsoft access token");

  const importIds = resolveImportCalendarIds(config);
  const calendarId = importIds[0];
  const ctx = { connectionId: CONNECTION_ID, config };

  const start = new Date(Date.now() + 9 * 24 * 3600_000);
  start.setUTCHours(16, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const startMoved = new Date(start.getTime() + 60 * 60_000);
  const endMoved = new Date(startMoved.getTime() + 30 * 60_000);

  let graphEventId: string | null = null;
  let appointmentId: string | null = null;
  let backstopGraphId: string | null = null;

  try {
    const createStarted = new Date();
    graphEventId = await insertMicrosoftEvent(
      token,
      {
        summary: marker,
        description: "Transovo M365 lifecycle E2E",
        start,
        end,
        timezone: "America/New_York",
        calendarId,
      },
      ctx,
    );
    if (!graphEventId) throw new Error("Graph create failed");

    let created = await waitForAppointmentByMarker(marker, createStarted);
    if (!created) {
      console.log("[lifecycle] webhook wait exceeded — running direct calendar sync (backstop path)");
      await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, { incremental: true });
      created = await waitForAppointmentByMarker(marker, createStarted);
    }
    results.push({
      step: "create_import",
      ok: Boolean(created),
      detail: { graphEventId, appointmentId: created?.id, path: created ? "webhook_or_sync" : "timeout" },
    });
    if (!created) throw new Error("Create import timeout");
    appointmentId = created.id;

    await updateMicrosoftEvent(token, graphEventId, { summary: markerRenamed }, ctx);
    const syncAfterRename = await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, {
      incremental: true,
    });
    const renamed = await waitForAppointmentUpdate(appointmentId, (a) => a.serviceName === markerRenamed);
    results.push({
      step: "update_title",
      ok: renamed,
      detail: { syncStats: syncAfterRename },
    });

    await updateMicrosoftEvent(
      token,
      graphEventId,
      { start: startMoved, end: endMoved, timezone: "America/New_York" },
      ctx,
    );
    await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, { incremental: true });
    const syncAfterMove = await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, {
      incremental: true,
    });
    const moved = await waitForAppointmentUpdate(
      appointmentId,
      (a) => Math.abs(a.startsAt.getTime() - startMoved.getTime()) < 300_000,
    );
    results.push({
      step: "update_time_same_row",
      ok: moved,
      detail: { syncStats: syncAfterMove, expectedStart: startMoved.toISOString() },
    });

    await deleteMicrosoftEvent(token, graphEventId, ctx);
    graphEventId = null;
    const syncAfterDelete = await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, {
      incremental: true,
    });
    const canceled = await waitForAppointmentUpdate(
      appointmentId,
      (a) =>
        ["canceled", "cancelled"].includes(a.status) ||
        a.metadata?.reminderStatus === "canceled",
    );
    const dispatches = await prisma.arReminderDispatch.findMany({
      where: { appointmentId },
      select: { status: true, timelineType: true },
    });
    results.push({
      step: "delete_cancel",
      ok: canceled,
      detail: { syncStats: syncAfterDelete, dispatches },
    });

    const backstopStarted = new Date();
    backstopGraphId = await insertMicrosoftEvent(
      token,
      {
        summary: backstopMarker,
        description: "Backstop reconcile test",
        start: new Date(start.getTime() + 86400000),
        end: new Date(end.getTime() + 86400000),
        timezone: "America/New_York",
        calendarId,
      },
      ctx,
    );
    if (!backstopGraphId) throw new Error("Backstop Graph create failed");

    await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, { incremental: true });

    const backstopAppt = await waitForAppointmentByMarker(backstopMarker, backstopStarted);
    const connAfter = await prisma.voiceCalendarConnection.findUnique({
      where: { id: CONNECTION_ID },
      select: {
        id: true,
        lastSyncAt: true,
        lastSyncSuccessAt: true,
        nextSyncDueAt: true,
        subscriptionRenewDueAt: true,
      },
    });
    results.push({
      step: "reconcile_backstop_import",
      ok: Boolean(backstopAppt),
      detail: { connAfter, backstopAppointmentId: backstopAppt?.id, note: "direct sync backstop (no webhook wait)" },
    });

    if (backstopGraphId && CLEANUP) {
      await deleteMicrosoftEvent(token, backstopGraphId, ctx).catch(() => undefined);
      await syncWorkspaceCalendarConnection(WORKSPACE_ID, CONNECTION_ID, { incremental: true });
      backstopGraphId = null;
    }
  } finally {
    if (CLEANUP && graphEventId) {
      await deleteMicrosoftEvent(token, graphEventId, ctx).catch(() => undefined);
    }
    if (CLEANUP && backstopGraphId) {
      await deleteMicrosoftEvent(token, backstopGraphId, ctx).catch(() => undefined);
    }
  }

  const allOk = results.every((r) => r.ok);
  console.log("\n[lifecycle] SUMMARY", allOk ? "PASS" : "FAIL", JSON.stringify(results, null, 2));
  if (!allOk) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
