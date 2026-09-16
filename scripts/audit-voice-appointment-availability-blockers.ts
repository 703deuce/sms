#!/usr/bin/env npx tsx
/**
 * Forensic audit: VoiceAppointment rows vs Microsoft Graph + reconciliation class.
 *
 * WORKSPACE_ID=ws_1 APPOINTMENT_IDS=id1,id2 npx tsx scripts/audit-voice-appointment-availability-blockers.ts
 * SLOT_DATE=2026-09-17 — load rows overlapping that local day in booking timezone
 */
import { getPrisma } from "../src/lib/db";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";
import { resolveMctbMicrosoftConnectionId } from "../src/lib/mctb/ai-booking/microsoft-connection";
import {
  getMicrosoftBusy,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "../src/lib/voice/calendar/providers";
import { wallTimeInZoneToUtc, zonedDateParts } from "../src/lib/voice/calendar/timezone-slots";
import { toMicrosoftDateTimeTimeZone } from "../src/lib/microsoft/graph-datetime-timezone";
import {
  classifyVoiceAppointmentForAvailability,
  voiceAppointmentBlocksAvailability,
} from "../src/lib/voice/calendar/voice-appointment-reconcile";
import { MICROSOFT_GRAPH_V1 } from "../src/lib/microsoft/graph-helpers";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const APPOINTMENT_IDS = (process.env.APPOINTMENT_IDS || "cmtwukh1e6z3d3i025g5p2j5j,cmtwusuef1u271e215w345n5u")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatInstantInZone(date: Date, iana: string): string {
  const p = zonedDateParts(date, iana);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)} (${iana})`;
}

async function fetchGraphEvent(
  token: string,
  eventId: string,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const url = `${MICROSOFT_GRAPH_V1}/me/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

async function main() {
  const prisma = getPrisma();
  const bookingCfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const businessTz = bookingCfg.timezone?.trim() || "America/Los_Angeles";

  const serializerSample = toMicrosoftDateTimeTimeZone(
    new Date("2026-09-15T23:00:00.000Z"),
    businessTz,
  );
  console.log("=== Timezone serializer (production module) ===");
  console.log(JSON.stringify(serializerSample, null, 2));

  const connectionId = await resolveMctbMicrosoftConnectionId(
    WORKSPACE_ID,
    bookingCfg.calendarId || bookingCfg.providerConnectionId,
  );
  if (!connectionId) throw new Error("microsoft_connection_not_found");

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId: WORKSPACE_ID, provider: "microsoft" },
  });
  if (!conn) throw new Error("connection_missing");
  const config = (conn.config || {}) as CalendarConfig;
  const token = hasOAuthTokens(config) ? await getValidAccessToken(conn.id, "microsoft", config) : null;

  console.log("\n=== Connection ===");
  console.log({
    connectionId: conn.id,
    status: conn.status,
    mailbox: config.email,
    calendarIds: config.calendarIds,
  });

  const rows = await prisma.voiceAppointment.findMany({
    where: { workspaceId: WORKSPACE_ID, id: { in: APPOINTMENT_IDS } },
  });

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;
  for (const row of rows) {
    if (!rangeStart || row.startsAt < rangeStart) rangeStart = row.startsAt;
    const end = row.endsAt || row.startsAt;
    if (!rangeEnd || end > rangeEnd) rangeEnd = end;
  }

  if (process.env.SLOT_DATE) {
    const [y, m, d] = process.env.SLOT_DATE.split("-").map(Number);
    rangeStart = wallTimeInZoneToUtc(businessTz, y, m, d, 0, 0);
    rangeEnd = wallTimeInZoneToUtc(businessTz, y, m, d, 23, 59);
  }

  if (rangeStart && rangeEnd && token) {
    const graphBusy = await getMicrosoftBusy(token, rangeStart, rangeEnd, {
      ctx: { connectionId: conn.id, config },
      smtp: config.email,
    });
    console.log("\n=== Graph calendarView busy (range) ===");
    console.log({
      rangeStartUtc: rangeStart.toISOString(),
      rangeEndUtc: rangeEnd.toISOString(),
      busyCount: graphBusy.length,
      busy: graphBusy.map((b) => ({
        start: b.start.toISOString(),
        end: b.end.toISOString(),
      })),
    });
  }

  console.log("\n=== VoiceAppointment rows ===");
  for (const row of rows) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const classification = classifyVoiceAppointmentForAvailability(row);
    const rowTz = row.timezone?.trim() || businessTz;
    console.log("\n---", row.id, "---");
    console.log({
      createdAt: row.createdAt.toISOString(),
      status: row.status,
      externalId: row.externalId,
      classification,
      blocksAvailability: voiceAppointmentBlocksAvailability(classification),
      startsAtUtc: row.startsAt.toISOString(),
      endsAtUtc: row.endsAt?.toISOString(),
      storedTimezone: row.timezone,
      localWallStart: formatInstantInZone(row.startsAt, rowTz),
      localWallEnd: row.endsAt ? formatInstantInZone(row.endsAt, rowTz) : null,
      businessLocalStart: formatInstantInZone(row.startsAt, businessTz),
      metadataSource: meta.source,
      invitee: meta.inviteeName,
    });

    if (token && row.externalId) {
      const ev = await fetchGraphEvent(token, row.externalId);
      console.log("Graph event by externalId:", ev?.status, ev?.body?.start, ev?.body?.end);
    } else {
      console.log("Graph event by externalId: (none on row)");
    }
  }

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
