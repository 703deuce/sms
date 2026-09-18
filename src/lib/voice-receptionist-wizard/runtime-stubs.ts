/** No-op stubs for removed Voice V2 call runtime (warmup, warm transfer). */

export function scheduleVoiceV2CallWarmup(_input: Record<string, unknown>): void {}

export async function terminateVoiceV2CallSessionOnHangup(_input: {
  callId?: string;
  sessionKey?: string;
}): Promise<void> {}

export async function scheduleWarmupForVoiceCall(_input: Record<string, unknown>): Promise<void> {}

export async function handleWarmTransferLeg(_input: Record<string, unknown>): Promise<void> {
  return;
}

export function getWarmTransferStore(): { clear: () => void } {
  return { clear: () => undefined };
}
