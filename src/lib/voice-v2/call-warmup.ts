import "server-only";

import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { resolveMctbMicrosoftConnectionId } from "@/lib/mctb/ai-booking/microsoft-connection";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { buildVoiceV2CallContextPayload } from "./session/context-build";
import {
  createVoiceV2CallContext,
  getVoiceV2CallContextL1,
  loadVoiceV2CallContext,
  resolveVoiceV2SessionKey,
} from "./session/call-context-store";
import { warmMicrosoftTokenIfNeeded } from "./session/token-readiness";
import type { VoiceV2CallContext } from "./intake/types";

export type VoiceV2WarmupInput = {
  workspaceId: string;
  agentId: string;
  callId: string;
  callControlId: string;
  fromE164?: string | null;
  conversationId?: string | null;
  agentConfig?: VoiceAgentConfig | null;
};

export type VoiceV2WarmupResult = {
  canonicalSessionKey: string;
  l1Hydrated: boolean;
  l2Created: boolean;
  bookingEnabled: boolean;
  aborted: boolean;
};

type WarmupEntry = {
  abort: AbortController;
  promise: Promise<VoiceV2WarmupResult>;
  startedAt: number;
};

const warmupByCanonical = new Map<string, WarmupEntry>();

export function getVoiceV2WarmupEntry(canonicalKey: string): WarmupEntry | null {
  return warmupByCanonical.get(canonicalKey) ?? null;
}

export function abortVoiceV2CallWarmup(input: {
  callControlId?: string | null;
  callId?: string | null;
}): void {
  void (async () => {
    const canonical = await resolveVoiceV2SessionKey({
      callControlId: input.callControlId,
      callId: input.callId,
    });
    if (!canonical) return;
    const entry = warmupByCanonical.get(canonical);
    if (entry) {
      entry.abort.abort();
      warmupByCanonical.delete(canonical);
    }
    const { markVoiceV2CallContextEnded } = await import("./session/call-context-store");
    await markVoiceV2CallContextEnded(canonical).catch(() => undefined);
  })();
}

async function runWarmup(input: VoiceV2WarmupInput, signal: AbortSignal): Promise<VoiceV2WarmupResult> {
  const bookingEnabled = isVoiceV2PstnLiveBookingMode(input.agentConfig);
  const canonical =
    (await resolveVoiceV2SessionKey({
      callControlId: input.callControlId,
      callId: input.callId,
      conversationId: input.conversationId,
    })) || `call:${input.callId}`;

  if (getVoiceV2CallContextL1(canonical)) {
    return {
      canonicalSessionKey: canonical,
      l1Hydrated: true,
      l2Created: true,
      bookingEnabled,
      aborted: signal.aborted,
    };
  }

  const built = await buildVoiceV2CallContextPayload({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    canonicalSessionKey: canonical,
    callId: input.callId,
    fromE164: input.fromE164,
  });

  if (signal.aborted) {
    return {
      canonicalSessionKey: canonical,
      l1Hydrated: false,
      l2Created: false,
      bookingEnabled,
      aborted: true,
    };
  }

  await createVoiceV2CallContext(
    {
      payload: built.payload,
      identity: {
        sessionKey: canonical,
        callId: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        telnyxCallControlId: input.callControlId,
        telnyxConversationId: input.conversationId || undefined,
      },
      enrollment: built.enrollment,
    },
    { l2Persist: "await" },
  );

  if (bookingEnabled && !signal.aborted) {
    const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
    const connectionId = await resolveMctbMicrosoftConnectionId(
      input.workspaceId,
      bookingCfg.calendarId || bookingCfg.providerConnectionId,
    );
    void warmMicrosoftTokenIfNeeded({
      workspaceId: input.workspaceId,
      connectionId,
      bookingEnabled: true,
      signal,
    }).catch(() => undefined);
  }

  return {
    canonicalSessionKey: canonical,
    l1Hydrated: Boolean(getVoiceV2CallContextL1(canonical)),
    l2Created: true,
    bookingEnabled,
    aborted: signal.aborted,
  };
}

/** Fire-and-forget — must not be awaited on answer/greeting path. */
export function scheduleVoiceV2CallWarmup(input: VoiceV2WarmupInput): void {
  void startVoiceV2CallWarmup(input).catch((err) => {
    console.warn("[voice-v2/warmup]", err instanceof Error ? err.message : err);
  });
}

export function startVoiceV2CallWarmup(input: VoiceV2WarmupInput): Promise<VoiceV2WarmupResult> {
  const bookingEnabled = isVoiceV2PstnLiveBookingMode(input.agentConfig);
  if (!bookingEnabled) {
    return Promise.resolve({
      canonicalSessionKey: "",
      l1Hydrated: false,
      l2Created: false,
      bookingEnabled: false,
      aborted: false,
    });
  }

  let canonicalPromise = resolveVoiceV2SessionKey({
    callControlId: input.callControlId,
    callId: input.callId,
    conversationId: input.conversationId,
  });

  return canonicalPromise.then(async (canonical) => {
    const key = canonical || `call:${input.callId}`;
    const existing = warmupByCanonical.get(key);
    if (existing && !existing.abort.signal.aborted) {
      return existing.promise;
    }
    const abort = new AbortController();
    const promise = runWarmup({ ...input }, abort.signal).finally(() => {
      const cur = warmupByCanonical.get(key);
      if (cur?.promise === promise) warmupByCanonical.delete(key);
    });
    warmupByCanonical.set(key, { abort, promise, startedAt: Date.now() });
    return promise;
  });
}

/** Join in-flight warmup or return hydrated context (for ensure). */
export async function joinVoiceV2CallWarmup(input: {
  callControlId?: string | null;
  callId?: string | null;
  conversationId?: string | null;
}): Promise<VoiceV2CallContext | null> {
  const canonical = await resolveVoiceV2SessionKey({
    callControlId: input.callControlId,
    callId: input.callId,
    conversationId: input.conversationId,
  });
  if (!canonical) return null;

  const l1 = getVoiceV2CallContextL1(canonical);
  if (l1) return l1;

  const entry = warmupByCanonical.get(canonical);
  if (entry && !entry.abort.signal.aborted) {
    await entry.promise.catch(() => undefined);
    return getVoiceV2CallContextL1(canonical) || (await loadVoiceV2CallContext(canonical));
  }
  return null;
}

/** Test helper */
export function clearVoiceV2WarmupForTests(): void {
  for (const e of warmupByCanonical.values()) e.abort.abort();
  warmupByCanonical.clear();
}
