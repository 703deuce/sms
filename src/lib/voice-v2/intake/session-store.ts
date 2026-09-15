import "server-only";

import type { VoiceV2CallContext } from "./types";
import {
  getVoiceV2CallContextL1,
  persistVoiceV2CallContextPayload,
  resetVoiceV2CallContextStoreForTests,
  updateVoiceV2CallContextL1Payload,
  loadVoiceV2CallContextRecord,
} from "../session/call-context-store";
import type { VoiceV2CallContextRecord } from "../session/types";

/** Sync read — L1 on this process only (hot path). */
export function getVoiceV2CallContext(sessionKey: string): VoiceV2CallContext | null {
  return getVoiceV2CallContextL1(sessionKey);
}

/** Updates L1 immediately; mirrors to L2 when a record exists (Class B, async). */
export function setVoiceV2CallContext(ctx: VoiceV2CallContext): void {
  updateVoiceV2CallContextL1Payload(ctx);
  void persistVoiceV2CallContextPayload(ctx, "B").catch((err) => {
    if (process.env.VOICE_V2_CONTEXT_METRICS === "1") {
      console.warn("[voice-v2/context-persist]", err instanceof Error ? err.message : err);
    }
  });
}

export function patchVoiceV2CallContext(
  sessionKey: string,
  patch: Partial<VoiceV2CallContext>,
): VoiceV2CallContext | null {
  const existing = getVoiceV2CallContext(sessionKey);
  if (!existing) return null;
  const next = { ...existing, ...patch, intakeState: patch.intakeState ?? existing.intakeState };
  setVoiceV2CallContext(next);
  return next;
}

/** Test-only */
export function clearVoiceV2CallSessions(): void {
  resetVoiceV2CallContextStoreForTests();
}

/** Test / admin — hydrate L1 from L2 */
export async function hydrateVoiceV2CallContextFromL2(
  sessionKey: string,
): Promise<VoiceV2CallContextRecord | null> {
  return loadVoiceV2CallContextRecord(sessionKey);
}
