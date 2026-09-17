import "server-only";

import type { LiveToolDispatchContext } from "@/lib/voice/telnyx/openai-live-bridge/live-tool-runtime";

export type VoiceV2TestFindExecutor = (input: {
  args: Record<string, unknown>;
  ctx: LiveToolDispatchContext;
}) => Promise<Record<string, unknown>>;

export type VoiceV2TestBookExecutor = (input: {
  args: Record<string, unknown>;
  ctx: LiveToolDispatchContext;
}) => Promise<Record<string, unknown>>;

export type VoiceV2TestExecutors = {
  findAvailability?: VoiceV2TestFindExecutor;
  bookOfferedSlot?: VoiceV2TestBookExecutor;
};

const overridesByCallId = new Map<string, VoiceV2TestExecutors>();

export function setVoiceV2TestExecutorsForCall(
  callId: string,
  executors: VoiceV2TestExecutors | null,
): void {
  if (!executors) {
    overridesByCallId.delete(callId);
    return;
  }
  overridesByCallId.set(callId, executors);
}

export function getVoiceV2TestExecutorsForCall(callId: string): VoiceV2TestExecutors | null {
  return overridesByCallId.get(callId) ?? null;
}

export function clearAllVoiceV2TestExecutors(): void {
  overridesByCallId.clear();
}

export function shouldUseInjectedVoiceV2Executors(callId: string): boolean {
  if (overridesByCallId.has(callId)) return true;
  const mode = String(process.env.VOICE_V2_TEST_EXECUTORS || "").trim().toLowerCase();
  return mode === "fake" || mode === "inject";
}
