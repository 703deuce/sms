import "server-only";

import { getVoiceV2CallContext } from "./session-store";
import {
  createVoiceV2CallContext,
  loadVoiceV2CallContext,
  resolveVoiceV2SessionKey,
} from "../session/call-context-store";
import { buildVoiceV2CallContextPayload } from "../session/context-build";
import { joinVoiceV2CallWarmup } from "../call-warmup";

export function resolveSessionKey(input: {
  callControlId?: string | null;
  conversationId?: string | null;
}): string | null {
  const cc = input.callControlId?.trim();
  if (cc) return `cc:${cc}`;
  const conv = input.conversationId?.trim();
  if (conv) return `conv:${conv}`;
  return null;
}

export type EnsureCallContextTrace = {
  cache_hit: boolean;
  config_load_ms: number;
  config_compile_ms: number;
  booking_cfg_load_ms: number;
  session_create_ms: number;
};

/** L1 → join warmup → L2 → cold build (single-flight via warmup when possible). */
export async function ensureVoiceV2CallContext(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  callId?: string | null;
  trace?: import("./save-intake-trace").SaveIntakeTrace;
}): Promise<import("./types").VoiceV2CallContext | null> {
  const sessionKey = resolveSessionKey(input);
  if (!sessionKey && !input.callId) return null;

  input.trace?.mark("CALL_CONTEXT_LOOKUP_START");
  const canonical =
    (await resolveVoiceV2SessionKey({
      callControlId: input.callControlId,
      conversationId: input.conversationId,
      callId: input.callId,
    })) || sessionKey;
  if (!canonical) return null;

  const l1 =
    getVoiceV2CallContext(canonical) || (sessionKey ? getVoiceV2CallContext(sessionKey) : null);
  input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: Boolean(l1) });
  if (l1) return l1;

  const fromWarmup = await joinVoiceV2CallWarmup({
    callControlId: input.callControlId,
    callId: input.callId,
    conversationId: input.conversationId,
  });
  if (fromWarmup) {
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "warmup" });
    return fromWarmup;
  }

  const fromStore = await loadVoiceV2CallContext(canonical);
  if (fromStore) {
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "l2" });
    return fromStore;
  }

  input.trace?.mark("CONFIG_LOAD_START");
  const cfgStart = Date.now();
  const built = await buildVoiceV2CallContextPayload({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    canonicalSessionKey: canonical,
    callId: input.callId,
    fromE164: input.fromE164,
  });
  input.trace?.mark("CONFIG_LOAD_END", { ms: Date.now() - cfgStart });
  input.trace?.mark("CONFIG_COMPILE_END", { ms: 0 });
  input.trace?.mark("BOOKING_CFG_LOAD_END", { ms: 0 });

  input.trace?.mark("SESSION_CREATE_START");
  const createStart = Date.now();
  const cc = input.callControlId?.trim();
  const conv = input.conversationId?.trim();

  await createVoiceV2CallContext(
    {
      payload: built.payload,
      identity: {
        sessionKey: canonical,
        callId: input.callId?.trim() || canonical,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        telnyxCallControlId: cc || undefined,
        telnyxConversationId: conv || undefined,
      },
      enrollment: built.enrollment,
    },
    { l2Persist: "background" },
  );

  input.trace?.mark("SESSION_CREATE_END", { ms: Date.now() - createStart });
  return built.payload;
}
