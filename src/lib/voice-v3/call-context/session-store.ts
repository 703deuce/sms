import type { VoiceV3CallContext } from "./types";

const TTL_MS = 2 * 60 * 60 * 1000;
const store = new Map<string, { ctx: VoiceV3CallContext; expiresAt: number }>();

function prune(now: number): void {
  for (const [key, row] of store) {
    if (row.expiresAt <= now) store.delete(key);
  }
}

export function getVoiceV3CallContext(liveSessionId: string): VoiceV3CallContext | null {
  const id = liveSessionId.trim();
  if (!id) return null;
  const now = Date.now();
  prune(now);
  const row = store.get(id);
  if (!row) return null;
  if (row.expiresAt <= now) {
    store.delete(id);
    return null;
  }
  return row.ctx;
}

export function setVoiceV3CallContext(ctx: VoiceV3CallContext): void {
  const id = ctx.liveSessionId.trim();
  if (!id) return;
  const now = Date.now();
  prune(now);
  store.set(id, { ctx, expiresAt: now + TTL_MS });
}

export function deleteVoiceV3CallContext(liveSessionId: string): void {
  store.delete(liveSessionId.trim());
}

/** Test-only */
export function clearVoiceV3CallContextStore(): void {
  store.clear();
}
