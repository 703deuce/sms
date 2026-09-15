import "server-only";

import type { VoiceV2CallContext } from "./types";

const TTL_MS = 2 * 60 * 60_000;
const sessions = new Map<string, { ctx: VoiceV2CallContext; expiresAt: number }>();

function prune(): void {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (v.expiresAt <= now) sessions.delete(k);
  }
}

export function getVoiceV2CallContext(sessionKey: string): VoiceV2CallContext | null {
  prune();
  const row = sessions.get(sessionKey);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    sessions.delete(sessionKey);
    return null;
  }
  return row.ctx;
}

export function setVoiceV2CallContext(ctx: VoiceV2CallContext): void {
  prune();
  sessions.set(ctx.sessionKey, { ctx, expiresAt: Date.now() + TTL_MS });
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
  sessions.clear();
}
