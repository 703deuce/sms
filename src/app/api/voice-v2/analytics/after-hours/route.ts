import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { aggregateAfterHoursAnalytics } from "@/lib/voice-v2/operating-maturity/analytics";
import type { AfterHoursAnalyticsRow } from "@/lib/voice-v2/operating-maturity/analytics";
import type { VoiceV2FrictionSignalType } from "@/lib/voice-v2/operating-maturity/types";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("error" in auth || !auth.workspaceId) {
    return ("error" in auth && auth.error) || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 86400000);
  const toDate = to ? new Date(to) : new Date();

  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: auth.workspaceId,
      direction: "INBOUND",
      isTest: false,
      startedAt: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true,
      outcome: true,
      metadata: true,
      appointmentBooked: true,
    },
    take: 500,
    orderBy: { startedAt: "desc" },
  });

  const rows: AfterHoursAnalyticsRow[] = calls.map((c) => {
    const meta = (c.metadata || {}) as Record<string, unknown>;
    const quality = meta.voiceV2Quality as Record<string, unknown> | undefined;
    const friction = (quality?.frictionSignals as Array<{ type: string }>) || [];
    return {
      callId: c.id,
      resolution: String(quality?.resolutionStatus || meta.voiceV2ResolutionStatus || "UNRESOLVED_ABANDONED") as AfterHoursAnalyticsRow["resolution"],
      operatingState: meta.voiceV2OperatingState ? String(meta.voiceV2OperatingState) : undefined,
      primaryOutcome: c.outcome || undefined,
      frictionTypes: friction.map((f) => f.type as VoiceV2FrictionSignalType),
      recoverySent: meta.voiceV2AiCallRecoverySent === true,
      callbackLifecycle: meta.voiceV2CallbackSla
        ? String((meta.voiceV2CallbackSla as Record<string, unknown>).lifecycle)
        : undefined,
    };
  });

  return NextResponse.json({
    ok: true,
    range: { from: fromDate.toISOString(), to: toDate.toISOString() },
    summary: aggregateAfterHoursAnalytics(rows),
  });
}
