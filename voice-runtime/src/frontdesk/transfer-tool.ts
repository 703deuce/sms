import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";
import { isAgentSessionAlive } from "../session-utils";
import type { FrontDeskUserData } from "./userdata";
import { withLiveKitToolTelemetry } from "../livekit-tool-telemetry";
import { notifyReceptionistStaff } from "@/lib/voice/receptionist/notifications";
import { writeTransferToProvider } from "./transfer-provider-write";
import { tryConfirmationSpeech } from "./runtime-transaction";
import {
  formatToolFeedbackForModel,
  toolFeedbackSuccess,
  toolFeedbackTerminal,
  toolFeedbackTransferFailure,
  type RecoveryClass,
} from "../tool-feedback";

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

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const dest = await prisma.voiceTransferDestination.findFirst({
    where: { workspaceId, enabled: true },
    orderBy: { updatedAt: "desc" },
    select: { destination: true },
  });
  return dest?.destination?.trim() || null;
}

function transferRecoveryClass(reason: string): RecoveryClass {
  const lower = reason.toLowerCase();
  if (/busy|decline|rejected|486/i.test(lower)) return "TRANSFER_BUSY";
  if (/no answer|unavailable|timeout|no_answer/i.test(lower)) return "TRANSFER_NO_ANSWER";
  if (/rate|429|503|502|temporarily/i.test(lower)) return "TEMPORARY_PROVIDER_ERROR";
  return "UNKNOWN_FAILURE";
}

async function speakTransferBridge(
  session: AgentSession<FrontDeskUserData>,
  text: string,
): Promise<boolean> {
  if (!isAgentSessionAlive(session)) return false;
  try {
    await deliverScriptedSpeech(session, text, {
      allowInterruptions: false,
      addToChatCtx: true,
    });
    return true;
  } catch {
    return false;
  }
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
          const takeMessage =
            (ud.receptionistCompiled?.transferPolicy as { takeMessageOnFailure?: boolean } | undefined)
              ?.takeMessageOnFailure !== false;
          return formatToolFeedbackForModel(
            toolFeedbackTerminal({
              tool: "transfer_to_human",
              recovery_class: "RESOURCE_UNAVAILABLE",
              reason: "no_destination",
              next_action: takeMessage ? "take_message" : "continue_conversation",
              guidance: takeMessage
                ? "Transfer isn't configured. Offer to take a message for the team."
                : "Transfer isn't available right now.",
            }),
          );
        }

        const transferPolicy = ud.receptionistCompiled?.transferPolicy as
          | { warmTransfer?: boolean }
          | undefined;
        const transferType =
          transferPolicy?.warmTransfer === false ? "blind_transfer" : "warm_transfer";

        const result = await writeTransferToProvider({
          userData: ud,
          destination,
          reason,
          transferType,
        });

        if (!result.ok) {
          await notifyTransferFailure(ud, reason, result.reason);
          const takeMessage =
            (ud.receptionistCompiled?.transferPolicy as { takeMessageOnFailure?: boolean } | undefined)
              ?.takeMessageOnFailure !== false;

          if (result.reason === "no_transfer_path") {
            return formatToolFeedbackForModel(
              toolFeedbackTerminal({
                tool: "transfer_to_human",
                recovery_class: "RESOURCE_UNAVAILABLE",
                reason: "no_transfer_path",
                next_action: takeMessage ? "take_message" : "continue_conversation",
                runtime_handled_retry: true,
                caller_already_heard_failure: true,
                guidance: takeMessage
                  ? "Can't transfer this call right now — offer to take a message."
                  : "Can't transfer this call right now.",
              }),
            );
          }

          return formatToolFeedbackForModel(
            toolFeedbackTransferFailure({
              reason: result.reason,
              takeMessage,
              recoveryClass: transferRecoveryClass(result.reason),
            }),
          );
        }

        const isEmergency = isEmergencyTransfer(reason, ud);
        const bridgeLine = isEmergency
          ? "I understand this is urgent — let me connect you with someone right now. Please hold."
          : "Let me connect you with someone who can help. Please hold.";
        await tryConfirmationSpeech(session, "transfer", bridgeLine, speakTransferBridge);

        return formatToolFeedbackForModel(
          toolFeedbackSuccess("Transferring now — caller is on hold.", {
            tool: "transfer_to_human",
            next_action: "end_call",
            guidance: "Stay silent after the bridge line — the transfer is in progress.",
          }),
        );
      });
    },
  });
}
