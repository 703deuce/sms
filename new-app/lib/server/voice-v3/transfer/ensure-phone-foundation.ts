import "server-only";

import { getPrisma } from "@/lib/server/db";
import { resolvePhoneFoundationForVoiceV3Session } from "@/lib/server/voice-v3/resolve-phone-foundation";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { logVoiceV3TransferEvent } from "./telemetry";

/** Late-bind Phone Call Control context before transfer (session resolve can miss it). */
export async function ensurePhoneFoundationForTransfer(input: {
  runtime: VoiceV3CallRuntime;
  workspaceId: string;
}): Promise<VoiceV3CallContext> {
  const snap = input.runtime.getSnapshot();
  if (snap.phoneFoundation?.humanCallId && snap.phoneFoundation.inboundCallControlId) {
    return snap;
  }

  const prisma = getPrisma();
  const voiceRow = await prisma.voiceCall.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [
        { id: snap.callId },
        { metadata: { path: ["liveSessionId"], equals: snap.liveSessionId } },
      ],
    },
    select: { fromE164: true, toE164: true },
  });

  const phoneFoundation = await resolvePhoneFoundationForVoiceV3Session({
    workspaceId: input.workspaceId,
    callerE164: snap.telephony.inboundCallerE164 ?? voiceRow?.fromE164,
    businessLineE164: voiceRow?.toE164,
    liveSessionId: snap.liveSessionId,
  });

  if (!phoneFoundation) {
    logVoiceV3TransferEvent("VOICE_V3_PHONE_FOUNDATION_LOOKUP_MISS", {
      call_id: snap.callId,
      live_session_id: snap.liveSessionId,
      caller_present: Boolean(snap.telephony.inboundCallerE164 ?? voiceRow?.fromE164),
      business_line_present: Boolean(voiceRow?.toE164),
    });
    return snap;
  }

  const next = { ...snap, phoneFoundation };
  input.runtime.replaceContext(next);
  logVoiceV3TransferEvent("VOICE_V3_PHONE_FOUNDATION_BOUND_AT_TRANSFER", {
    call_id: snap.callId,
    live_session_id: snap.liveSessionId,
    human_call_id: phoneFoundation.humanCallId,
    inbound_call_control_prefix: phoneFoundation.inboundCallControlId.slice(0, 8),
  });
  return next;
}
