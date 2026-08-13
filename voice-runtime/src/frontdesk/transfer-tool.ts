import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { transferLiveKitSipParticipant } from "@/lib/voice/livekit/sip-transfer";
import { initiateTransfer } from "@/lib/voice/transfers";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolveTransferDestination(
  workspaceId: string,
  ud?: FrontDeskUserData,
): Promise<string | null> {
  const compiledNumber = ud?.realEstateCompiled?.transfer?.transferNumber?.trim();
  if (ud?.realEstateCompiled?.transfer?.enabled && compiledNumber) {
    return compiledNumber;
  }

  const receptionistPolicy = ud?.receptionistCompiled?.transferPolicy as
    | { destinationE164?: string; transferNumber?: string; enabled?: boolean }
    | undefined;
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
        const destination = await resolveTransferDestination(ud.workspaceId, ud);
        if (!destination) {
          throw new llm.ToolError(
            "I can't transfer this call right now — I can take a message for the team instead.",
          );
        }

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
            transferType: "warm_transfer",
            summary: reason || "Caller requested human",
            timeoutSeconds: 25,
          });
          return "Transferring you now — please hold.";
        }

        if (livekitRoomName && livekitParticipantId) {
          const xfer = await transferLiveKitSipParticipant({
            roomName: livekitRoomName,
            participantIdentity: livekitParticipantId,
            destinationE164: destination,
          });
          if (!xfer.ok) {
            throw new llm.ToolError(
              `I couldn't complete the transfer (${xfer.reason}). I can take a message instead.`,
            );
          }
          return "Transferring you now — please hold.";
        }

        throw new llm.ToolError(
          "I can't transfer this call right now — I can take a message for the team instead.",
        );
      });
    },
  });
}
