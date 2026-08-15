import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { transferLiveKitSipParticipant } from "@/lib/voice/livekit/sip-transfer";
import { initiateTransfer } from "@/lib/voice/transfers";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { notifyReceptionistStaff } from "@/lib/voice/receptionist/notifications";

async function notifyTransferFailure(
  ud: FrontDeskUserData,
  reason?: string,
  failureReason?: string,
): Promise<void> {
  const notifyOnFailure =
    (ud.receptionistCompiled?.transferPolicy as { notifyOnFailure?: boolean } | undefined)
      ?.notifyOnFailure !== false;
  if (!notifyOnFailure && !ud.receptionistCompiled?.notifications?.notifyTransferFail) return;
  await notifyReceptionistStaff({
    workspaceId: ud.workspaceId,
    callId: ud.callId,
    event: "transfer_failed",
    businessName: ud.businessName,
    callerE164: ud.callerE164,
    detail: [reason, failureReason].filter(Boolean).join(" — "),
    snapshot: ud.receptionistCompiled,
  }).catch(() => undefined);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isEmergencyTransfer(reason?: string, ud?: FrontDeskUserData): boolean {
  const text = (reason || "").trim().toLowerCase();
  if (!text) return false;
  if (text.includes("emergency")) return true;
  const rules = ud?.receptionistCompiled?.decisionRules || [];
  for (const rule of rules) {
    const condition = String((rule as { condition?: string }).condition || "").toLowerCase();
    const action = String((rule as { action?: string }).action || "").toLowerCase();
    if (action === "transfer" && condition.includes("emergency") && text.includes("emergency")) {
      return true;
    }
  }
  return false;
}

async function resolveTransferDestination(
  workspaceId: string,
  ud?: FrontDeskUserData,
  reason?: string,
): Promise<string | null> {
  const compiledNumber = ud?.realEstateCompiled?.transfer?.transferNumber?.trim();
  if (ud?.realEstateCompiled?.transfer?.enabled && compiledNumber) {
    return compiledNumber;
  }

  const receptionistPolicy = ud?.receptionistCompiled?.transferPolicy as
    | {
        destinationE164?: string;
        transferNumber?: string;
        emergencyDestinationE164?: string;
        enabled?: boolean;
      }
    | undefined;

  const emergencyNumber = receptionistPolicy?.emergencyDestinationE164?.trim();
  if (emergencyNumber && isEmergencyTransfer(reason, ud)) {
    return emergencyNumber;
  }

  const receptionistNumber =
    receptionistPolicy?.destinationE164?.trim() ||
    receptionistPolicy?.transferNumber?.trim();
  if (receptionistNumber) {
    return receptionistNumber;
  }

  const fallback = process.env.VOICE_TRANSFER_FALLBACK_E164?.trim();
  if (fallback) return fallback;

  const prisma = getPrisma();
  const dest = await prisma.voiceTransferDestination.findFirst({
    where: { workspaceId, enabled: true },
    orderBy: { updatedAt: "desc" },
    select: { destination: true },
  });
  return dest?.destination?.trim() || null;
}

async function markVoiceCallTransferred(
  workspaceId: string,
  callId: string,
  destination: string,
  reason?: string,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      transferred: true,
      status: "TRANSFERRED",
      outcome: "transferred",
      metadata: {
        ...meta,
        transferDestination: destination,
        transferReason: reason || "Caller requested human",
        transferCompletedAt: new Date().toISOString(),
      },
    },
  });
}

export function buildFrontDeskTransferTool() {
  return llm.tool({
    name: "transfer_to_human",
    description:
      "Transfer the caller to a human after they confirm they want to speak with someone.",
    parameters: z.object({
      reason: z.string().optional().describe("Brief reason for the transfer"),
    }),
    execute: async ({ reason }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "transfer_to_human", { reason }, async () => {
        const destination = await resolveTransferDestination(ud.workspaceId, ud, reason);
        if (!destination) {
          throw new llm.ToolError(
            "I can't transfer this call right now — I can take a message for the team instead.",
          );
        }

        const isEmergency = isEmergencyTransfer(reason, ud);
        const bridgeLine = isEmergency
          ? "I understand this is urgent — let me connect you with someone right now. Please hold."
          : "Let me connect you with someone who can help. Please hold.";
        await deliverScriptedSpeech(session, bridgeLine, {
          allowInterruptions: false,
          addToChatCtx: true,
        });

        const transferPolicy = ud.receptionistCompiled?.transferPolicy as
          | { warmTransfer?: boolean }
          | undefined;
        const transferType =
          transferPolicy?.warmTransfer === false ? "blind_transfer" : "warm_transfer";

        const prisma = getPrisma();
        const call = await prisma.voiceCall.findUnique({
          where: { id: ud.callId },
          select: { telnyxCallControlId: true, metadata: true },
        });
        const meta = asRecord(call?.metadata);
        const livekitRoomName =
          ud.livekitRoomName ||
          (typeof meta.livekitRoomName === "string" ? meta.livekitRoomName : null);
        const livekitParticipantId =
          ud.livekitParticipantId ||
          (typeof meta.livekitParticipantId === "string" ? meta.livekitParticipantId : null);

        if (call?.telnyxCallControlId) {
          await initiateTransfer({
            workspaceId: ud.workspaceId,
            callId: ud.callId,
            destination,
            transferType,
            summary: reason || "Caller requested human",
            timeoutSeconds: 25,
          });
          await markVoiceCallTransferred(ud.workspaceId, ud.callId, destination, reason);
          return "Transferring you now — please hold.";
        }

        if (livekitRoomName && livekitParticipantId) {
          const xfer = await transferLiveKitSipParticipant({
            roomName: livekitRoomName,
            participantIdentity: livekitParticipantId,
            destinationE164: destination,
          });
          if (!xfer.ok) {
            await notifyTransferFailure(ud, reason, xfer.reason);
            const takeMessage =
              (ud.receptionistCompiled?.transferPolicy as { takeMessageOnFailure?: boolean } | undefined)
                ?.takeMessageOnFailure !== false;
            throw new llm.ToolError(
              takeMessage
                ? `I couldn't complete the transfer (${xfer.reason}). I can take a message instead.`
                : `I couldn't complete the transfer (${xfer.reason}).`,
            );
          }
          await markVoiceCallTransferred(ud.workspaceId, ud.callId, destination, reason);
          return "Transferring you now — please hold.";
        }

        await notifyTransferFailure(ud, reason, "no_transfer_path");
        const takeMessage =
          (ud.receptionistCompiled?.transferPolicy as { takeMessageOnFailure?: boolean } | undefined)
            ?.takeMessageOnFailure !== false;
        throw new llm.ToolError(
          takeMessage
            ? "I can't transfer this call right now — I can take a message for the team instead."
            : "I can't transfer this call right now.",
        );
      });
    },
  });
}
