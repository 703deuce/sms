/**
 * Verify incremental delta sync reuses checkpoint (not bootstrap every run).
 * npx tsx scripts/verify-microsoft-delta-reuse.ts [connectionId]
 */
import { getWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import { syncMicrosoftCalendarDelta } from "@/lib/calendar/microsoft-delta-sync";
import { resolveMicrosoftCalendarViewSyncWindow } from "@/lib/calendar/microsoft-sync-window";
import type { CalendarConfig } from "@/lib/calendar/providers";

async function main() {
  const ws = process.env.WORKSPACE_ID || "ws_1";
  const connId = process.argv[2] || "cmu1uq7f15s1o5s4f6c5b6a57";
  const conn = await getWorkspaceCalendarConnection(ws, connId);
  if (!conn) throw new Error("Connection not found");
  const config = (conn.config || {}) as CalendarConfig;
  const calendarId = (config.importCalendarIds || [])[0];
  if (!calendarId) throw new Error("No importCalendarIds");
  const { timeMin, timeMax } = resolveMicrosoftCalendarViewSyncWindow(config);
  const before = config.microsoftDeltaLinks?.[calendarId]?.updatedAt;

  const r1 = await syncMicrosoftCalendarDelta({
    workspaceId: ws,
    connectionId: connId,
    calendarId,
    config,
    timeMin,
    timeMax,
    forceFull: false,
  });
  const after1 = config.microsoftDeltaLinks?.[calendarId]?.updatedAt;

  const r2 = await syncMicrosoftCalendarDelta({
    workspaceId: ws,
    connectionId: connId,
    calendarId,
    config,
    timeMin,
    timeMax,
    forceFull: false,
  });
  const after2 = config.microsoftDeltaLinks?.[calendarId]?.updatedAt;

  const pass =
    !r1.usedFullSync &&
    !r2.usedFullSync &&
    Boolean(r1.deltaLink) &&
    Boolean(r2.deltaLink) &&
    Boolean(after2);

  console.log(
    JSON.stringify(
      {
        pass,
        checkpointBefore: before,
        sync1: {
          usedFullSync: r1.usedFullSync,
          eventCount: r1.events.length,
          checkpointUpdatedAt: after1,
        },
        sync2: {
          usedFullSync: r2.usedFullSync,
          eventCount: r2.events.length,
          checkpointUpdatedAt: after2,
        },
      },
      null,
      2,
    ),
  );
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
