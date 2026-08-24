import { SipClient } from "livekit-server-sdk";
import type { MediaBackend } from "@/lib/voice/media-backend/types";
import {
  getActiveMediaBackend,
  resolveMediaBackend,
} from "@/lib/voice/media-backend/resolver";
import {
  getLiveKitSipClientForBackend,
  resetLiveKitClientsForTests,
} from "@/lib/voice/media-backend/client";

/**
 * LiveKit SIP client for the active media backend, or an explicit override.
 * Prefer getLiveKitSipClientForCall(callId) for active calls.
 */
export function getLiveKitSipClient(backend?: MediaBackend): SipClient {
  return getLiveKitSipClientForBackend(backend ?? getActiveMediaBackend());
}

export async function getLiveKitSipClientForCall(
  callId: string,
): Promise<SipClient> {
  const backend = await resolveMediaBackend({ callId });
  return getLiveKitSipClientForBackend(backend);
}

export async function getLiveKitSipClientResolved(
  context?: Parameters<typeof resolveMediaBackend>[0],
): Promise<{ client: SipClient; backend: MediaBackend }> {
  const backend = await resolveMediaBackend(context || {});
  return {
    client: getLiveKitSipClientForBackend(backend),
    backend,
  };
}

/** @internal test hook */
export function setDefaultLiveKitSipBackendForTests(_backend: MediaBackend | null) {
  // no-op: active backend comes from MEDIA_BACKEND_MODE only
}

export function resetLiveKitSipClientForTests() {
  resetLiveKitClientsForTests();
}
