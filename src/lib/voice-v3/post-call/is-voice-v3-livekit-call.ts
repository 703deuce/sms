import "server-only";

import type { VoiceCall } from "@prisma/client";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Voice V3 appointment receptionist calls on LiveKit (not legacy Telnyx assistant webhooks). */
export function isVoiceV3LiveKitCall(call: Pick<VoiceCall, "metadata" | "telnyxConversationId">): boolean {
  const meta = asRecord(call.metadata);
  const source = String(meta.source || "");
  if (source === "livekit_voice_runtime") return true;
  const fp = asRecord(meta.voiceConfigFingerprint);
  if (String(fp.runtimeProvider || "") === "livekit") return true;
  // Telnyx conversation assistant path is legacy V2 — do not route to V3 pipeline.
  if (call.telnyxConversationId) return false;
  return Boolean(meta.livekitRoomName);
}

/** Completed-call post-processing pipeline (recording → Deepgram → summary → side effects). */
export function isVoiceV3PostCallEligible(
  call: Pick<VoiceCall, "metadata" | "telnyxConversationId" | "agentId">,
): boolean {
  const meta = asRecord(call.metadata);
  if (meta.voiceV3WizardBound === true) return true;
  const transport = String(meta.voiceTransport || "");
  if (transport.includes("voice_v3")) return true;
  return isVoiceV3LiveKitCall(call);
}
