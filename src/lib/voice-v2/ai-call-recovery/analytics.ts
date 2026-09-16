import "server-only";

import { emitPlatformEvent } from "@/lib/platform/events";

export async function recordVoiceV2AiCallRecoveryAnalytics(
  workspaceId: string,
  metric: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await emitPlatformEvent({
    workspaceId,
    type: "VOICE_V2_AI_CALL_RECOVERY",
    payload: { metric, ...payload },
    idempotencyKey: `voice-v2-acr:${metric}:${String(payload.callId || "")}:${Date.now()}`,
  }).catch(() => undefined);
}
