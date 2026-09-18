import "server-only";

/** Voice V2 AI call recovery SMS path removed — MCTB / V3 use canonical handlers. */
export async function tryHandleVoiceV2AiCallRecoveryInboundSms(_input: {
  workspaceId: string;
  conversationId: string;
  fromE164: string;
  toE164: string;
  body: string;
  providerMessageId?: string | null;
}): Promise<{ handled: false } | { handled: true; reply: string }> {
  return { handled: false };
}
