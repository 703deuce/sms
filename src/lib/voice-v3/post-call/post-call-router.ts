import "server-only";

import { getPrisma } from "@/lib/db";
import { processPostCall } from "@/lib/voice/post-call";
import { isVoiceV3PostCallEligible } from "./is-voice-v3-livekit-call";
import { processVoiceV3CompletedCall } from "./process-completed-call";

/** Single entry for `voice_post_call` / `voice_v3_post_call` jobs. */
export async function routeVoicePostCallJob(callId: string): Promise<{ ok: boolean }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return { ok: false };

  if (isVoiceV3PostCallEligible(call)) {
    return processVoiceV3CompletedCall(callId);
  }
  return processPostCall(callId);
}
