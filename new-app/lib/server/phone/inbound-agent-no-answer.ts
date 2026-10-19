import { getPrisma } from "@/lib/server/db";
import { getCallRouting } from "@/lib/server/phone/routing";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { leaveVoicemailOnCall } from "@/lib/server/phone/voicemail-runtime";
import { patchInboundSession } from "@/lib/server/phone/inbound-session";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

/** Browser/agent leg ended without a bridge — caller should get no-answer or voicemail, not dead air. */
export async function handleInboundAgentLegNoAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  pstnCallControlId: string;
  phoneNumberId: string | null;
  hangupCause?: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) return;

  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (meta.inboundBridge === "bridged") return;

  phoneServerLog("inbound-webrtc-bridge", "agent_leg_no_answer", {
    humanCallId: input.humanCallId,
    hangupCause: input.hangupCause || null,
  });

  const routing = await getCallRouting(input.workspaceId);
  if (routing.noAnswer === "voicemail") {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: input.pstnCallControlId,
      phoneNumberId: input.phoneNumberId,
    });
    return;
  }

  await telnyxCallAction(input.pstnCallControlId, "hangup").catch(() => undefined);
  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "missed",
      disposition: `missed:${input.hangupCause || "agent_no_answer"}`,
      endedAt: new Date(),
      metadata: patchInboundSession(meta, {
        inboundBridgeStatus: "ended",
        ringTimeoutAt: null,
      }),
    },
  });
}
