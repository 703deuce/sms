import { getPrisma } from "@/lib/server/db";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import type { AnswerClassification } from "./types";
import type { ScreeningRuntimeDecision } from "./screening-runtime";
import { mergeAttemptMetadata } from "./attempt-metadata";
import type { ConnectionPhase } from "./connection-intelligence";

export async function executeScreeningDecision(input: {
  workspaceId: string;
  humanCallId: string;
  attemptId: string;
  classification: AnswerClassification;
  decision: ScreeningRuntimeDecision;
  idempotencyKey: string;
}): Promise<{ executed: boolean; phase?: ConnectionPhase; error?: string }> {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { humanCall: true },
  });
  if (!attempt?.humanCall) return { executed: false, error: "attempt_not_found" };

  const meta = readScreeningExecMeta(attempt.metadataJson);
  if (meta.lastScreeningExecKey === input.idempotencyKey) {
    return { executed: false, error: "duplicate_exec" };
  }

  const controlId = attempt.humanCall.telnyxCallControlId;
  const patchMeta: Record<string, unknown> = {
    lastScreeningExecKey: input.idempotencyKey,
    screeningAction: input.decision.action,
    screeningReason: input.decision.reason,
  };

  switch (input.decision.action) {
    case "hangup": {
      if (controlId) {
        await telnyxCallAction(controlId, "hangup", {}).catch((err) => {
          patchMeta.screeningActionFailed = err instanceof Error ? err.message : String(err);
        });
      }
      await prisma.powerDialerAttempt.update({
        where: { id: input.attemptId },
        data: {
          status: "completed",
          endedAt: new Date(),
          answerClassification: input.classification,
          metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
            ...patchMeta,
            connectionPhase: "screening_declined",
            screeningOutcome: "hangup_policy",
          }),
        },
      });
      return { executed: true, phase: "screening_declined" };
    }
    case "voicemail_path": {
      await prisma.powerDialerAttempt.update({
        where: { id: input.attemptId },
        data: {
          metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
            ...patchMeta,
            connectionPhase: "voicemail",
            screeningOutcome: "voicemail_path",
          }),
        },
      });
      return { executed: true, phase: "voicemail" };
    }
    case "notify_rep": {
      await prisma.powerDialerAttempt.update({
        where: { id: input.attemptId },
        data: {
          metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
            ...patchMeta,
            connectionPhase: "screening_detected",
            screeningNotifyRep: true,
          }),
        },
      });
      return { executed: true, phase: "screening_detected" };
    }
    case "connect_rep":
    default: {
      if (input.classification === "screener") {
        await prisma.powerDialerAttempt.update({
          where: { id: input.attemptId },
          data: {
            metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
              ...patchMeta,
              connectionPhase: "waiting_for_recipient",
            }),
          },
        });
        return { executed: true, phase: "waiting_for_recipient" };
      }
      return { executed: false };
    }
  }
}

function readScreeningExecMeta(raw: unknown): { lastScreeningExecKey?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as { lastScreeningExecKey?: string };
}
