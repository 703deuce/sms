import { NextResponse } from "next/server";
import {
  clearCfnaProbeEvents,
  isCfnaProbeDbEnabled,
  isCfnaProbeEnabled,
  listCfnaProbeDbEvents,
  listCfnaProbeEvents,
} from "@/lib/mctb/cfna-ingress-probe";

export const runtime = "nodejs";

/** Dev/diagnostic: recent CFNA ingress probe events (in-memory + optional DB). */
export async function GET(request: Request) {
  const dbEnabled = isCfnaProbeDbEnabled();
  if (!isCfnaProbeEnabled() && !dbEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CFNA probe disabled. Set MCTB_CFNA_PROBE=1 (console) or MCTB_CFNA_PROBE_DB=1 (production DB).",
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 40)));
  const clear = url.searchParams.get("clear") === "1";
  const source = url.searchParams.get("source") || "all";

  const memoryEvents = source === "db" ? [] : listCfnaProbeEvents(limit);
  const dbEvents = dbEnabled && source !== "memory" ? await listCfnaProbeDbEvents(limit) : [];

  if (clear && isCfnaProbeEnabled()) clearCfnaProbeEvents();

  const latestMctbEntry = dbEvents.find(
    (row) => row.layer === "mctb-entry" && row.mctbEntryInvoked === true,
  );

  return NextResponse.json({
    ok: true,
    probeEnabled: isCfnaProbeEnabled(),
    probeDbEnabled: dbEnabled,
    count: memoryEvents.length + dbEvents.length,
    memoryCount: memoryEvents.length,
    dbCount: dbEvents.length,
    events: memoryEvents,
    dbEvents,
    fork: latestMctbEntry
      ? {
          mctbEntryInvoked: latestMctbEntry.mctbEntryInvoked,
          texmlGenerated: latestMctbEntry.texmlGenerated,
          responseStatus: latestMctbEntry.responseStatus,
          responseLatencyMs: latestMctbEntry.responseLatencyMs,
          callSid: latestMctbEntry.callSid,
          calledDid: latestMctbEntry.calledDid,
          recordedAt: latestMctbEntry.recordedAt,
        }
      : dbEnabled
        ? {
            mctbEntryInvoked: false,
            note: "No mctb-entry row in DB — voice_url likely never hit the app on recent CFNA tests",
          }
        : null,
    hint: "Dev: npm run dev:cfna-probe-test (or watch: npm run watch:cfna-probe)",
  });
}
