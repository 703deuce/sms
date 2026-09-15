import "server-only";

export class VoiceV2SharedSessionUnavailableError extends Error {
  readonly code = "VOICE_V2_SHARED_SESSION_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "VoiceV2SharedSessionUnavailableError";
  }
}

/**
 * Production shared L2 requires Redis unless explicitly overridden (tests only).
 * Set VOICE_V2_ALLOW_MEMORY_L2=1 for local/test in-memory L2.
 */
export function assertVoiceV2SharedSessionBackendAllowed(): void {
  if (process.env.VOICE_V2_ALLOW_MEMORY_L2 === "1") return;
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.REDIS_URL?.trim()) {
    throw new VoiceV2SharedSessionUnavailableError(
      "Voice V2 shared CallContext (L2) requires REDIS_URL in production. " +
        "Set REDIS_URL or do not enable Voice V2 multi-instance session until configured.",
    );
  }
}

export function isVoiceV2ProductionMemoryL2Blocked(): boolean {
  try {
    assertVoiceV2SharedSessionBackendAllowed();
    return false;
  } catch {
    return true;
  }
}
