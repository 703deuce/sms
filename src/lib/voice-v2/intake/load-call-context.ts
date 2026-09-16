import "server-only";

import { performance } from "node:perf_hooks";

import { getVoiceV2CallContext } from "./session-store";
import {
  createVoiceV2CallContext,
  fetchVoiceV2L2ContextBundle,
  getVoiceV2CallContextL1,
  hydrateL1FromRecord,
  isVoiceV2SessionTerminated,
  loadVoiceV2CallContext,
  resolveVoiceV2SessionKey,
} from "../session/call-context-store";
import { buildVoiceV2CallContextPayload } from "../session/context-build";
import { joinVoiceV2CallWarmup } from "../call-warmup";
import {
  createVoiceV2ContextLookupTrace,
  type VoiceV2ContextLookupTrace,
} from "../session/context-lookup-trace";
import { isTrustedPrismaVoiceCallId } from "./resolve-trusted-call-id";

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

function trustedCanonicalFromPrismaCallId(prismaCallId: string): string {
  return `call:${prismaCallId.trim()}`;
}

/** L1 → join warmup → L2 → cold build (single-flight via warmup when possible). */
export async function ensureVoiceV2CallContext(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  /** Prisma VoiceCall id when trusted (runtime), not Telnyx call_control id. */
  callId?: string | null;
  trustedPrismaCallId?: string | null;
  trace?: import("./save-intake-trace").SaveIntakeTrace;
  lookupTrace?: VoiceV2ContextLookupTrace;
}): Promise<import("./types").VoiceV2CallContext | null> {
  const sessionKey = resolveSessionKey(input);
  const trusted =
    input.trustedPrismaCallId?.trim() ||
    (input.callId?.trim() && isTrustedPrismaVoiceCallId(input.callId) ? input.callId.trim() : "");
  if (!sessionKey && !trusted) return null;

  const lookup =
    input.lookupTrace ??
    createVoiceV2ContextLookupTrace({
      input_identifier_type: trusted ? "trusted_call_id" : sessionKey?.startsWith("cc:")
        ? "call_control"
        : sessionKey?.startsWith("conv:")
          ? "conversation"
          : "unknown",
      input_identifier_value: trusted || sessionKey || "",
    });

  const t0 = performance.now();
  input.trace?.mark("CALL_CONTEXT_LOOKUP_START");

  let canonical = "";
  let canonicalSource = "";

  if (trusted) {
    canonical = trustedCanonicalFromPrismaCallId(trusted);
    lookup.canonical_key_known_at_entry = true;
    lookup.canonical_key_source = "trusted_prisma_call_id";
    lookup.ALIAS_LOOKUP_MS = 0;
  } else {
    lookup.canonical_key_known_at_entry = false;
    const aliasStart = performance.now();
    canonical =
      (await resolveVoiceV2SessionKey({
        callControlId: input.callControlId,
        conversationId: input.conversationId,
        callId: input.callId,
      })) || sessionKey || "";
    lookup.ALIAS_LOOKUP_MS = performance.now() - aliasStart;
    canonicalSource = "alias_resolve";
    lookup.canonical_key_source = canonicalSource;
  }

  lookup.canonical_key = canonical;
  if (!canonical) {
    lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: false, source: "unresolved" });
    return null;
  }

  const l1Start = performance.now();
  let ctx =
    getVoiceV2CallContext(canonical) || (sessionKey ? getVoiceV2CallContext(sessionKey) : null);
  lookup.L1_DIRECT_LOOKUP_MS = performance.now() - l1Start;

  if (ctx) {
    const tombStart = performance.now();
    const terminated = await isVoiceV2SessionTerminated(canonical);
    lookup.TOMBSTONE_CHECK_MS = performance.now() - tombStart;
    if (terminated) {
      lookup.CONTEXT_SOURCE = "terminated";
      lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
      input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: false, source: "terminated" });
      return null;
    }
    lookup.CONTEXT_SOURCE = trusted ? "l1_direct" : "l1_after_alias";
    lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", {
      cache_hit: true,
      source: lookup.CONTEXT_SOURCE,
      context_lookup: lookup,
    });
    return ctx;
  }

  const fromWarmup = await joinVoiceV2CallWarmup({
    callControlId: input.callControlId,
    callId: trusted || input.callId,
    conversationId: input.conversationId,
  });
  if (fromWarmup) {
    const tombStart = performance.now();
    const terminated = await isVoiceV2SessionTerminated(canonical);
    lookup.TOMBSTONE_CHECK_MS += performance.now() - tombStart;
    if (terminated) {
      lookup.CONTEXT_SOURCE = "terminated";
      lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
      input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: false, source: "terminated" });
      return null;
    }
    lookup.CONTEXT_SOURCE = "warmup";
    lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "warmup", context_lookup: lookup });
    return fromWarmup;
  }

  const bundle = await fetchVoiceV2L2ContextBundle(canonical);
  lookup.TOMBSTONE_CHECK_MS += bundle.tombstoneMs;
  lookup.L2_CONTEXT_GET_MS += bundle.contextGetMs;
  lookup.L2_DESERIALIZE_MS += bundle.deserializeMs;

  if (bundle.terminated) {
    lookup.CONTEXT_SOURCE = "terminated";
    lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: false, source: "terminated" });
    return null;
  }

  if (bundle.record) {
    const hydrateStart = performance.now();
    ctx = hydrateL1FromRecord(bundle.record);
    lookup.L1_HYDRATE_MS = performance.now() - hydrateStart;
    lookup.CONTEXT_SOURCE = "l2";
    lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "l2", context_lookup: lookup });
    return ctx;
  }

  const fromStore = await loadVoiceV2CallContext(canonical);
  if (fromStore) {
    lookup.CONTEXT_SOURCE = "l2";
    lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "l2", context_lookup: lookup });
    return fromStore;
  }

  input.trace?.mark("CONFIG_LOAD_START");
  const cfgStart = Date.now();
  const built = await buildVoiceV2CallContextPayload({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    canonicalSessionKey: canonical,
    callId: trusted || input.callId,
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
        callId: trusted || input.callId?.trim() || canonical,
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
  lookup.CONTEXT_SOURCE = "created";
  lookup.CONTEXT_TOTAL_MS = performance.now() - t0;
  input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "created", context_lookup: lookup });
  return built.payload;
}
