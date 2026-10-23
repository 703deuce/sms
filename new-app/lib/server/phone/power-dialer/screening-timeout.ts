import { getPrisma } from "@/lib/server/db";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { mergeAttemptMetadata, readAttemptMetadata } from "./attempt-metadata";

const DEFAULT_SCREENING_WAIT_MS = 45_000;

/**
 * Bounded wait when screening is detected without a post-screening human AMD result.
 * No fabricated acceptance signal — timeout records inconclusive screening outcome.
 */
export async function scheduleScreeningTimeout(input: {
  workspaceId: string;
  attemptId: string;
  humanCallId: string;
  waitMs?: number;
}) {
  if (process.env.POWER_DIALER_SCREENING_TIMEOUT_MOCK === "1") {
    return { scheduled: true, mocked: true };
  }
  const waitMs = input.waitMs ?? DEFAULT_SCREENING_WAIT_MS;
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { humanCall: true },
  });
  if (!attempt) return { scheduled: false };

  const meta = readAttemptMetadata(attempt.metadataJson);
  if (!meta.screeningPending && attempt.answerClassification !== "screener") {
    return { scheduled: false, reason: "not_screening" };
  }
  if (meta.screeningTimeoutScheduled) return { scheduled: false, reason: "already_scheduled" };

  await prisma.powerDialerAttempt.update({
    where: { id: input.attemptId },
    data: {
      metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
        screeningTimeoutScheduled: true,
        screeningTimeoutAt: new Date(Date.now() + waitMs).toISOString(),
      }),
    },
  });

  setTimeout(async () => {
    const row = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.attemptId, workspaceId: input.workspaceId },
      include: { humanCall: true },
    });
    if (!row || row.endedAt) return;
    const m = readAttemptMetadata(row.metadataJson);
    if (!m.screeningPending && row.answerClassification !== "screener") return;
    if (row.answerClassification === "human") return;

    const controlId = row.humanCall?.telnyxCallControlId;
    if (controlId) {
      await telnyxCallAction(controlId, "hangup", {}).catch(() => undefined);
    }
    await prisma.powerDialerAttempt.update({
      where: { id: input.attemptId },
      data: {
        status: "completed",
        endedAt: new Date(),
        metadataJson: mergeAttemptMetadata(row.metadataJson, {
          screeningPending: false,
          screeningOutcome: "timeout",
          connectionPhase: "screening_declined",
        }),
      },
    });
  }, waitMs);

  return { scheduled: true };
}
