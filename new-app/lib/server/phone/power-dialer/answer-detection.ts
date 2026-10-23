import { getPrisma } from "@/lib/server/db";
import type { AnswerClassification } from "./types";

const MACHINE_RESULTS = new Set([
  "machine",
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
  "fax_detected",
]);
const HUMAN_RESULTS = new Set(["human", "human_residence", "human_business"]);
const UNCERTAIN_RESULTS = new Set(["not_sure", "silence", ""]);

export function mapTelnyxAmdResult(raw: string): AnswerClassification {
  const r = raw.toLowerCase().trim();
  if (!r) return "uncertain";
  if (MACHINE_RESULTS.has(r)) return "voicemail";
  if (r.includes("screen")) return "screener";
  if (HUMAN_RESULTS.has(r)) return "human";
  if (UNCERTAIN_RESULTS.has(r)) return "uncertain";
  if (r.includes("machine")) return "voicemail";
  if (r.includes("human")) return "human";
  return "uncertain";
}

export async function recordPowerDialerDetectionEvent(input: {
  workspaceId: string;
  attemptId?: string | null;
  humanCallId?: string | null;
  eventType: string;
  result?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const prisma = getPrisma();
  if (input.idempotencyKey) {
    const existing = await prisma.powerDialerDetectionEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }
  return prisma.powerDialerDetectionEvent.create({
    data: {
      workspaceId: input.workspaceId,
      attemptId: input.attemptId ?? undefined,
      humanCallId: input.humanCallId ?? undefined,
      eventType: input.eventType,
      result: input.result ?? undefined,
      payload: input.payload as import("@prisma/client").Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function applyAmdToPowerDialerAttempt(input: {
  workspaceId: string;
  humanCallId: string;
  amdResult: string;
  eventType: string;
  idempotencyKey: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") return { handled: false };

  const attemptId = (call.metadata as { powerDialerAttemptId?: string } | null)?.powerDialerAttemptId;
  await recordPowerDialerDetectionEvent({
    workspaceId: input.workspaceId,
    attemptId,
    humanCallId: call.id,
    eventType: input.eventType,
    result: input.amdResult,
    idempotencyKey: input.idempotencyKey,
    payload: { amdResult: input.amdResult },
  });

  const classification = mapTelnyxAmdResult(input.amdResult);
  if (attemptId) {
    await prisma.powerDialerAttempt.updateMany({
      where: { id: attemptId, workspaceId: input.workspaceId },
      data: { answerClassification: classification },
    });
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: attemptId, workspaceId: input.workspaceId },
      include: { session: true },
    });
    if (attempt?.session?.campaignId) {
      const { resolveScreeningDecision } = await import("./screening-runtime");
      const decision = await resolveScreeningDecision({
        workspaceId: input.workspaceId,
        campaignId: attempt.session.campaignId,
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
      if (classification === "screener" && decision.action === "connect_rep") {
        const { maybePlayScreenerIntro } = await import("./screener-intro-playback");
        await maybePlayScreenerIntro({
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          attemptId,
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

    if (classification === "human" && attempt?.sessionId) {
      const { isMultiLineDialMode, normalizeDialingMode } = await import("./dial-modes");
      const { onParallelHumanAnswered } = await import("./parallel-orchestrator");
      const { resolveCampaignRules } = await import("./campaign-config");
      const campaign = await prisma.powerDialerCampaign.findFirst({
        where: { id: attempt.session.campaignId },
      });
      if (campaign) {
        const rules = resolveCampaignRules(campaign);
        if (isMultiLineDialMode(normalizeDialingMode(rules.dialingMode))) {
          await onParallelHumanAnswered({
            workspaceId: input.workspaceId,
            sessionId: attempt.sessionId,
            attemptId,
            answeredAt: new Date(),
          }).catch(() => undefined);
        }
      }
    }
  }
  return { handled: true, classification };
}
