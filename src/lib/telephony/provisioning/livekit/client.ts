import { SipClient } from "livekit-server-sdk";
import type { MediaBackend } from "@/lib/voice/media-backend/types";
import {
  getLiveKitSipClientForBackend,
  resetLiveKitClientsForTests,
  resolveMediaBackend,
} from "@/lib/voice/media-backend";

let defaultBackend: MediaBackend | null = null;

/**
 * LiveKit SIP client for the given backend, or LiveKit Cloud when omitted.
 * Prefer getLiveKitSipClientForCall(callId) for active calls.
 */
export function getLiveKitSipClient(backend?: MediaBackend): SipClient {
  if (backend) {
    return getLiveKitSipClientForBackend(backend);
  }
  if (defaultBackend) {
    return getLiveKitSipClientForBackend(defaultBackend);
  }
  return getLiveKitSipClientForBackend("livekit_cloud");
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

/** @internal test hook — avoid async resolve in unit tests */
export function setDefaultLiveKitSipBackendForTests(backend: MediaBackend | null) {
  defaultBackend = backend;
}

export function resetLiveKitSipClientForTests() {
  defaultBackend = null;
  resetLiveKitClientsForTests();
}
