import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { loadMissedCallTextConfig } from "./config";
import { appendMctbTrace } from "./trace";
import { traceMctbPipeline } from "@/lib/mctb/pipeline-trace";

export async function scheduleMissedCallText(input: {
  workspaceId: string;
  missedCallEventId: string;
  traceId: string;
  delaySeconds?: number;
  demoMode?: boolean;
}) {
  const config = await loadMissedCallTextConfig(input.workspaceId);
  const configuredDelay =
    input.demoMode === true ? 0 : (input.delaySeconds ?? config.delaySeconds);
  const delayMs = Math.max(0, configuredDelay * 1000);
  const runAt = new Date(Date.now() + delayMs);

  const prisma = getPrisma();
  await prisma.missedCallEvent.update({
    where: { id: input.missedCallEventId },
    data: {
      status: "SCHEDULED",
      scheduledSmsAt: runAt,
    },
  });

  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: input.missedCallEventId,
    kind: "mctb.scheduled",
    detail: { runAt: runAt.toISOString(), delayMs },
  });

  await enqueueJob({
    jobType: "john_mctb_send",
    queueName: "automations",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      missedCallEventId: input.missedCallEventId,
      traceId: input.traceId,
    },
    idempotencyKey: `john-mctb-send:${input.missedCallEventId}`,
    runAfter: runAt,
  });

  traceMctbPipeline({
    layer: "schedule",
    step: "john_mctb_send_enqueued",
    outcome: "queued",
    traceId: input.traceId,
    workspaceId: input.workspaceId,
    missedCallEventId: input.missedCallEventId,
    runAt: runAt.toISOString(),
    delayMs,
    demoMode: Boolean(input.demoMode),
  });
}
