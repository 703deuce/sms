import { getPrisma } from "@/lib/server/db";
import {
  mapTelnyxAmdResult,
  mapTelnyxScreeningDetected,
  isConfirmedHumanClassification,
  classificationBlocksParallelWinner,
} from "./answer-classification";
import { recordPowerDialerDetectionEvent } from "./answer-detection-events";
import { mergeAttemptMetadata, readAttemptMetadata } from "./attempt-metadata";
import { normalizeDialingMode, parseDialModeSettings, isMultiLineDialMode } from "./dial-modes";
import { executeScreeningDecision } from "./screening-executor";
import { resolveScreeningDecision } from "./screening-runtime";
import { scheduleScreeningTimeout } from "./screening-timeout";

export async function applyAmdToPowerDialerAttempt(input: {
  workspaceId: string;
  humanCallId: string;
  amdResult: string;
  eventType: string;
  idempotencyKey: string;
  /** When true, do not treat as final human until post-screening AMD */
  screeningStage?: "initial" | "post_screening";
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") return { handled: false as const };

  const attemptId = (call.metadata as { powerDialerAttemptId?: string } | null)?.powerDialerAttemptId;
  const attempt = attemptId
    ? await prisma.powerDialerAttempt.findFirst({
        where: { id: attemptId, workspaceId: input.workspaceId },
        include: { session: { include: { campaign: true } } },
      })
    : null;

  if (attempt?.endedAt && attempt.status === "completed") {
    await recordPowerDialerDetectionEvent({
      workspaceId: input.workspaceId,
      attemptId,
      humanCallId: call.id,
      eventType: "amd_stale_ignored",
      result: input.amdResult,
      idempotencyKey: `${input.idempotencyKey}:stale`,
      payload: { reason: "attempt_terminal" },
    });
    return { handled: true as const, classification: null, stale: true };
  }

  await recordPowerDialerDetectionEvent({
    workspaceId: input.workspaceId,
    attemptId,
    humanCallId: call.id,
    eventType: input.eventType,
    result: input.amdResult,
    idempotencyKey: input.idempotencyKey,
    payload: { amdResult: input.amdResult, screeningStage: input.screeningStage ?? null },
  });

  const classification = mapTelnyxAmdResult(input.amdResult);
  const priorMeta = attempt ? readAttemptMetadata(attempt.metadataJson) : {};
  const meta = attempt
    ? mergeAttemptMetadata(attempt.metadataJson, {
        telnyxAmdRaw: input.amdResult,
        amdEventType: input.eventType,
        screeningPending:
          classification === "human" ? false : priorMeta.screeningPending,
        screeningOutcome:
          classification === "human" && priorMeta.screeningPending
            ? "accepted_post_screening"
            : priorMeta.screeningOutcome,
        connectionPhase:
          classification === "human"
            ? "human_connected"
            : classification === "screener"
              ? "screening_detected"
              : isMachineLike(classification)
                ? "voicemail"
                : "checking_answer",
      })
    : undefined;

  if (attemptId && attempt) {
    await prisma.powerDialerAttempt.updateMany({
      where: { id: attemptId, workspaceId: input.workspaceId },
      data: {
        answerClassification: classification,
        ...(meta ? { metadataJson: meta } : {}),
      },
    });

    const campaignId = attempt.session?.campaignId;
    if (campaignId) {
      const decision = await resolveScreeningDecision({
        workspaceId: input.workspaceId,
        campaignId,
        classification,
      });
      await recordPowerDialerDetectionEvent({
        workspaceId: input.workspaceId,
        attemptId,
        humanCallId: input.humanCallId,
        eventType: "screening_decision",
        result: decision.action,
        payload: { reason: decision.reason, classification },
        idempotencyKey: `${input.idempotencyKey}:screening`,
      });
      await executeScreeningDecision({
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        attemptId,
        classification,
        decision,
        idempotencyKey: `${input.idempotencyKey}:exec`,
      });

      if (classification === "screener" && decision.action === "connect_rep") {
        const { maybePlayScreenerIntro } = await import("./screener-intro-playback");
        await maybePlayScreenerIntro({
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          attemptId,
        }).catch(() => undefined);
        await scheduleScreeningTimeout({
          workspaceId: input.workspaceId,
          attemptId,
          humanCallId: input.humanCallId,
        }).catch(() => undefined);
      }
    }

    const { maybeAutoDropVoicemailAfterAmd } = await import("./beep-auto-drop");
    await maybeAutoDropVoicemailAfterAmd({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      attemptId,
      amdResult: input.amdResult,
    }).catch(() => undefined);

    await maybeParallelBridgeAfterClassification({
      workspaceId: input.workspaceId,
      attempt,
      classification,
      amdResult: input.amdResult,
    });
  }
  return { handled: true as const, classification };
}

export async function applyScreeningDetectedToAttempt(input: {
  workspaceId: string;
  humanCallId: string;
  result: string;
  eventType: string;
  idempotencyKey: string;
}) {
  const classification = mapTelnyxScreeningDetected(input.result);
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") return { handled: false as const };

  const attemptId = (call.metadata as { powerDialerAttemptId?: string } | null)?.powerDialerAttemptId;
  await recordPowerDialerDetectionEvent({
    workspaceId: input.workspaceId,
    attemptId,
    humanCallId: call.id,
    eventType: input.eventType,
    result: input.result,
    idempotencyKey: input.idempotencyKey,
    payload: { screening: true },
  });

  if (!attemptId) return { handled: true as const, classification };

  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId: input.workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) return { handled: true as const, classification };

  await prisma.powerDialerAttempt.update({
    where: { id: attemptId },
    data: {
      answerClassification: classification,
      metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
        screeningDetectedAt: new Date().toISOString(),
        telnyxScreeningRaw: input.result,
        connectionPhase: "screening_detected",
        screeningPending: true,
      }),
    },
  });

  if (attempt.session?.campaignId) {
    const decision = await resolveScreeningDecision({
      workspaceId: input.workspaceId,
      campaignId: attempt.session.campaignId,
      classification,
    });
    await executeScreeningDecision({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      attemptId,
      classification,
      decision,
      idempotencyKey: `${input.idempotencyKey}:exec`,
    });
    if (decision.action === "connect_rep") {
      const { maybePlayScreenerIntro } = await import("./screener-intro-playback");
      await maybePlayScreenerIntro({
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        attemptId,
      }).catch(() => undefined);
    }
    await scheduleScreeningTimeout({
      workspaceId: input.workspaceId,
      attemptId,
      humanCallId: input.humanCallId,
    }).catch(() => undefined);
  }

  return { handled: true as const, classification };
}

export async function applyPremiumGreetingEnded(input: {
  workspaceId: string;
  humanCallId: string;
  result: string;
  eventType: string;
  idempotencyKey: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") return { handled: false as const };

  const attemptId = (call.metadata as { powerDialerAttemptId?: string } | null)?.powerDialerAttemptId;
  await recordPowerDialerDetectionEvent({
    workspaceId: input.workspaceId,
    attemptId,
    humanCallId: call.id,
    eventType: input.eventType,
    result: input.result,
    idempotencyKey: input.idempotencyKey,
  });

  const r = input.result.toLowerCase().trim();
  if (r === "prompt_ended" && attemptId) {
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: attemptId, workspaceId: input.workspaceId },
    });
    if (attempt) {
      await prisma.powerDialerAttempt.update({
        where: { id: attemptId },
        data: {
          metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
            iosPromptEndedAt: new Date().toISOString(),
            connectionPhase: "waiting_for_recipient",
          }),
        },
      });
      const { maybePlayScreenerIntro } = await import("./screener-intro-playback");
      await maybePlayScreenerIntro({
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        attemptId,
      }).catch(() => undefined);
    }
  }

  if (r === "beep_detected" && attemptId) {
    const { maybeAutoDropVoicemailAfterAmd } = await import("./beep-auto-drop");
    await maybeAutoDropVoicemailAfterAmd({
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      attemptId,
      amdResult: "machine_end_beep",
    }).catch(() => undefined);
  }

  return { handled: true as const };
}

async function maybeParallelBridgeAfterClassification(input: {
  workspaceId: string;
  attempt: {
    id: string;
    sessionId: string;
    metadataJson: unknown;
    session: { campaignId: string; campaign: { configJson: unknown; dialingMode?: string | null } };
  };
  classification: ReturnType<typeof mapTelnyxAmdResult>;
  amdResult: string;
}) {
  if (!isConfirmedHumanClassification(input.classification)) {
    const dialMode = normalizeDialingMode(input.attempt.session.campaign.dialingMode);
    const dialSettings = parseDialModeSettings(input.attempt.session.campaign.configJson);
    const amdFilter = readAttemptMetadata(input.attempt.metadataJson).amdFilter === true;
    if (
      isMultiLineDialMode(dialMode) &&
      classificationBlocksParallelWinner(input.classification, amdFilter || dialMode === "parallel_amd")
    ) {
      const { hangupNonHumanParallelLeg } = await import("./parallel-orchestrator");
      await hangupNonHumanParallelLeg({
        workspaceId: input.workspaceId,
        sessionId: input.attempt.sessionId,
        attemptId: input.attempt.id,
        classification: input.classification,
      }).catch(() => undefined);
    }
    return;
  }

  const dialMode = normalizeDialingMode(input.attempt.session.campaign.dialingMode);
  if (!isMultiLineDialMode(dialMode)) return;

  const meta = readAttemptMetadata(input.attempt.metadataJson);
  if (meta.screeningPending) return;

  const { onParallelHumanAnswered } = await import("./parallel-orchestrator");
  await onParallelHumanAnswered({
    workspaceId: input.workspaceId,
    sessionId: input.attempt.sessionId,
    attemptId: input.attempt.id,
    answeredAt: new Date(),
  }).catch(() => undefined);
}

function isMachineLike(c: string) {
  return c === "voicemail" || c === "machine" || c === "fax" || c === "ivr";
}
