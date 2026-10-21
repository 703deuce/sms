import "server-only";

import { getPrisma } from "@/lib/server/db";

export async function recordAiParticipationStart(workspaceId: string, humanCallId: string) {
  const call = await getPrisma().humanCall.findFirst({
    where: { id: humanCallId, workspaceId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta = (call.metadata as Record<string, unknown>) || {};
  const orch = (meta.orchestration as Record<string, unknown>) || {};
  if (orch.aiUsageRecordedStart) return;
  await getPrisma().humanCall.update({
    where: { id: humanCallId },
    data: {
      metadata: {
        ...meta,
        orchestration: {
          ...orch,
          aiUsageRecordedStart: new Date().toISOString(),
        },
      },
    },
  });
}

export async function recordAiParticipationEnd(workspaceId: string, humanCallId: string) {
  const call = await getPrisma().humanCall.findFirst({
    where: { id: humanCallId, workspaceId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta = (call.metadata as Record<string, unknown>) || {};
  const orch = (meta.orchestration as Record<string, unknown>) || {};
  const started = orch.aiUsageRecordedStart ? Date.parse(String(orch.aiUsageRecordedStart)) : NaN;
  const endedAt = new Date().toISOString();
  let aiSeconds = 0;
  if (!Number.isNaN(started)) {
    aiSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  }
  await getPrisma().humanCall.update({
    where: { id: humanCallId },
    data: {
      metadata: {
        ...meta,
        orchestration: {
          ...orch,
          aiUsageRecordedEnd: endedAt,
          aiParticipationSeconds: aiSeconds,
        },
      },
    },
  });
}
