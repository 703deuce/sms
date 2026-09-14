#!/usr/bin/env npx tsx
/**
 * Verify VoiceAppointment externalIds exist on Microsoft Calendar (Graph API).
 * WORKSPACE_ID=ws_1 npx tsx scripts/verify-microsoft-events-for-mctb.ts
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const DAY = process.env.DAY?.trim() || "2026-09-15";

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  const dayStart = new Date(`${DAY}T00:00:00.000Z`);
  const dayEnd = new Date(`${DAY}T23:59:59.999Z`);

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { workspaceId: WORKSPACE_ID, provider: "microsoft", status: "connected" },
    orderBy: { createdAt: "asc" },
  });
  if (!conn) {
    console.error("No connected Microsoft calendar for", WORKSPACE_ID);
    process.exit(1);
  }

  const appts = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      status: { not: "cancelled" },
      startsAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startsAt: "asc" },
  });

  console.log("=== Microsoft calendar truth check ===");
  console.log({ workspaceId: WORKSPACE_ID, day: DAY, connectionId: conn.id, connectionName: conn.name });

  const providers = await import("../src/lib/voice/calendar/providers");
  const {
    getValidAccessToken,
    getMicrosoftCalendarEvent,
    getMicrosoftBusy,
    hasOAuthTokens,
    resolveBlockingCalendarIds,
  } = providers;

  const config = (conn.config || {}) as import("../src/lib/voice/calendar/providers").CalendarConfig;
  if (!hasOAuthTokens(config)) {
    console.error("Calendar connection has no OAuth tokens");
    process.exit(1);
  }

  let token: string | null = null;
  try {
    token = await getValidAccessToken(conn.id, "microsoft", config);
  } catch (err) {
    console.warn(
      "Token refresh failed in this environment:",
      err instanceof Error ? err.message : err,
    );
  }
  if (!token) {
    console.warn(
      "\n⚠ Cannot call Microsoft Graph from here (OAuth refresh unavailable in this runtime).",
    );
    console.warn(
      "Below: booking-time proof that Graph accepted creates (externalId only set after insertMicrosoftEvent succeeds).\n",
    );
    for (const a of appts) {
      const meta = (a.metadata || {}) as Record<string, unknown>;
      const proof = a.externalId && meta.lastPushedAt;
      console.log(
        proof
          ? `  ✓ At book time Microsoft returned event id for ${a.startsAt.toISOString()} (Graph id starts with ${String(a.externalId).slice(0, 12)}…) lastPushedAt=${meta.lastPushedAt}`
          : `  ✗ No Graph event id stored for ${a.id}`,
      );
    }
    process.exit(0);
  }

  const ctx = { connectionId: conn.id, config };

  console.log("\n--- VoiceAppointment rows on this day (Transovo DB) ---");
  for (const a of appts) {
    console.log({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      timezone: a.timezone,
      serviceName: a.serviceName,
      externalId: a.externalId ? `${a.externalId.slice(0, 32)}…` : null,
    });
  }

  console.log("\n--- Graph: fetch each stored externalId (real Outlook event?) ---");
  for (const a of appts) {
    if (!a.externalId) {
      console.log(`✗ ${a.id}: NO externalId — not on Microsoft calendar`);
      continue;
    }
    try {
      const ev = await getMicrosoftCalendarEvent(token, a.externalId, ctx);
      if (!ev) {
        console.log(`✗ ${a.id}: Graph 404 / free — NOT on calendar`);
        continue;
      }
      console.log(`✓ ${a.id}: ON MICROSOFT CALENDAR`);
      console.log({
        graphId: ev.id.slice(0, 32) + "…",
        subject: ev.summary,
        start: ev.start.toISOString(),
        end: ev.end.toISOString(),
        status: ev.status,
        timezone: ev.timezone,
      });
    } catch (err) {
      console.log(`✗ ${a.id}: Graph error`, err instanceof Error ? err.message : err);
    }
  }

  const rangeStart = new Date(`${DAY}T07:00:00.000Z`);
  const rangeEnd = new Date(`${DAY}T23:00:00.000Z`);
  const calIds = resolveBlockingCalendarIds(config, "microsoft");
  const busyLists = await Promise.all(
    (calIds.length ? calIds : [undefined]).map((calId) =>
      getMicrosoftBusy(token, rangeStart, rangeEnd, {
        calendarId: calId || undefined,
        ctx,
        smtp: config.email,
      }),
    ),
  );
  const busy = busyLists.flat().sort((a, b) => a.start.getTime() - b.start.getTime());

  console.log("\n--- Graph: busy intervals used for availability (blocking calendars) ---");
  console.log(`blockingCalendarIds=${calIds.length ? calIds.join(", ") : "(default)"}`);
  for (const b of busy) {
    console.log(`  busy ${b.start.toISOString()} → ${b.end.toISOString()}`);
  }

  console.log("\n--- Interpretation (America/Los_Angeles) ---");
  const tz = "America/Los_Angeles";
  for (const a of appts) {
    const label = a.startsAt.toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const onGraph = a.externalId ? "see Graph result above" : "no external id";
    console.log(`  ${label} (${a.id.slice(0, 8)}…) — ${onGraph}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
