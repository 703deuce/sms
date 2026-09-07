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

  // Do not rely solely on background workers — press-1 callers expect the text promptly.
  // executeMissedCallTextSend is idempotent; the queued job remains as a retry path.
  try {
    const { executeMissedCallTextSend } = await import("./send");
    void executeMissedCallTextSend({
      workspaceId: input.workspaceId,
      missedCallEventId: input.missedCallEventId,
      traceId: input.traceId,
    }).catch((err) => {
      console.error("[mctb] inline missed-call-text send failed", err);
    });
  } catch (err) {
    console.error("[mctb] inline missed-call-text send import failed", err);
  }

  if (process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL) {
    try {
      const { syncDbOutboxToBullmq } = await import("@/lib/jobs/bullmq");
      void syncDbOutboxToBullmq(10).catch((err) => {
        console.warn("[mctb] syncDbOutboxToBullmq after schedule failed", err);
      });
    } catch {
      // optional — inline send above is the primary path for press-1
    }
  }

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
