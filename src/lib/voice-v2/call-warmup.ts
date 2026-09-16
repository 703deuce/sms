import "server-only";

import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { resolveMctbMicrosoftConnectionId } from "@/lib/mctb/ai-booking/microsoft-connection";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { buildVoiceV2CallContextPayload } from "./session/context-build";
import { voiceV2CapabilitiesFromPayload } from "./session/capability-pin";
import {
  createVoiceV2CallContext,
  getVoiceV2CallContextL1,
  loadVoiceV2CallContext,
  registerVoiceV2SessionTerminated,
  resolveVoiceV2SessionKey,
} from "./session/call-context-store";
import { warmMicrosoftTokenIfNeeded } from "./session/token-readiness";
import type { VoiceV2CallContext } from "./intake/types";
import { getVoiceV2InstanceId } from "./runtime/instance-id";

export type VoiceV2WarmupInput = {
  workspaceId: string;
  agentId: string;
  callId: string;
  callControlId: string;
  fromE164?: string | null;
  conversationId?: string | null;
  agentConfig?: VoiceAgentConfig | null;
  /** Wall ms when `startAiAssistantOnCall` returned (caller-visible path released). */
  assistantStartReturnedAt?: number;
  /** Wall ms when `scheduleVoiceV2CallWarmup` was invoked. */
  warmupScheduledAt?: number;
};

/** Gate invariant: no awaited Prisma telemetry before substantive warmup (see headless test). */
export const WARMUP_BLOCKING_TELEMETRY = 0;

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

/** Idempotent — safe from Telnyx hangup / conversation.ended handlers. */
export function terminateVoiceV2CallSessionOnHangup(input: {
  workspaceId?: string;
  callId?: string | null;
  callControlId?: string | null;
  conversationId?: string | null;
}): void {
  abortVoiceV2CallWarmup(input);
}

export function abortVoiceV2CallWarmup(input: {
  callControlId?: string | null;
  callId?: string | null;
  conversationId?: string | null;
}): void {
  const callId = input.callId?.trim();
  if (callId) {
    registerVoiceV2SessionTerminated(`call:${callId}`);
  }
  void (async () => {
    const canonical = await resolveVoiceV2SessionKey({
      callControlId: input.callControlId,
      callId: input.callId,
      conversationId: input.conversationId,
    });
    if (!canonical) return;
    registerVoiceV2SessionTerminated(canonical);
    const entry = warmupByCanonical.get(canonical);
    if (entry) {
      entry.abort.abort();
      warmupByCanonical.delete(canonical);
    }
    const { markVoiceV2CallContextEnded } = await import("./session/call-context-store");
    await markVoiceV2CallContextEnded(canonical).catch(() => undefined);
  })();
}

/** Deferred DB telemetry — never awaited on the warmup hot path. */
function deferWarmupEvent(
  input: VoiceV2WarmupInput,
  eventType: string,
  payload: Record<string, unknown>,
): void {
  void (async () => {
    try {
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      await prisma.voiceCallEvent.create({
        data: {
          workspaceId: input.workspaceId,
          callId: input.callId,
          eventType,
          payload: payload as object,
        },
      });
    } catch {
      // observe only
    }
  })();
}

async function runWarmup(input: VoiceV2WarmupInput, signal: AbortSignal): Promise<VoiceV2WarmupResult> {
  const warmupActualStartedAt = Date.now();
  const assistantReleaseMs =
    input.assistantStartReturnedAt != null
      ? warmupActualStartedAt - input.assistantStartReturnedAt
      : null;

  deferWarmupEvent(input, "voice_v2.warmup_started", {
    instance_id: getVoiceV2InstanceId(),
    at: warmupActualStartedAt,
    WARMUP_ACTUAL_STARTED_AT: warmupActualStartedAt,
    ASSISTANT_START_RETURNED_AT: input.assistantStartReturnedAt ?? null,
    WARMUP_SCHEDULED_AT: input.warmupScheduledAt ?? null,
    ASSISTANT_RELEASE_TO_WARMUP_START_MS: assistantReleaseMs,
  });

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

  try {
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
        capabilities: voiceV2CapabilitiesFromPayload(built.payload, {
          bookingEnabled: built.payload.capabilities?.bookingEnabled ?? bookingEnabled,
          voiceV2PstnLiveBooking:
            built.payload.capabilities?.voiceV2PstnLiveBooking ?? bookingEnabled,
        }),
      },
      { l2Persist: "await" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("session terminated") || signal.aborted) {
      return {
        canonicalSessionKey: canonical,
        l1Hydrated: false,
        l2Created: false,
        bookingEnabled,
        aborted: true,
      };
    }
    throw err;
  }

  if (signal.aborted) {
    const { markVoiceV2CallContextEnded } = await import("./session/call-context-store");
    await markVoiceV2CallContextEnded(canonical).catch(() => undefined);
    return {
      canonicalSessionKey: canonical,
      l1Hydrated: false,
      l2Created: false,
      bookingEnabled,
      aborted: true,
    };
  }

  const l2ReadyAt = Date.now();
  deferWarmupEvent(input, "voice_v2.warmup_l2_ready", {
    instance_id: getVoiceV2InstanceId(),
    at: l2ReadyAt,
    WARMUP_L2_READY_AT: l2ReadyAt,
    WARMUP_DURATION_MS: l2ReadyAt - warmupActualStartedAt,
    canonicalSessionKey: canonical,
  });

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
  const warmupScheduledAt = input.warmupScheduledAt ?? Date.now();
  const withTiming: VoiceV2WarmupInput = { ...input, warmupScheduledAt };
  deferWarmupEvent(withTiming, "voice_v2.warmup_scheduled", {
    instance_id: getVoiceV2InstanceId(),
    at: warmupScheduledAt,
    WARMUP_SCHEDULED_AT: warmupScheduledAt,
    ASSISTANT_START_RETURNED_AT: withTiming.assistantStartReturnedAt ?? null,
    ASSISTANT_RELEASE_TO_WARMUP_SCHEDULE_MS:
      withTiming.assistantStartReturnedAt != null
        ? warmupScheduledAt - withTiming.assistantStartReturnedAt
        : null,
  });
  void startVoiceV2CallWarmup(withTiming).catch((err) => {
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
