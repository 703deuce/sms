import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import { compileVoiceV2IntakeSchema } from "./compile-schema";
import { getVoiceV2CallContext, setVoiceV2CallContext } from "./session-store";
import type { VoiceV2IntakeState } from "./types";
import {
  createVoiceV2CallContext,
  loadVoiceV2CallContext,
  resolveVoiceV2SessionKey,
} from "../session/call-context-store";
import { buildVoiceV2EnrollmentSnapshot } from "../session/enrollment";

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

function prefillPhone(fromE164?: string | null): VoiceV2IntakeState {
  const ani = normalizeCallerAni(fromE164 || "");
  if (!ani) return {};
  return {
    phone: {
      value: ani,
      status: "PREFILLED",
      source: "CALLER_ID",
      updatedAt: new Date().toISOString(),
    },
  };
}

export type EnsureCallContextTrace = {
  cache_hit: boolean;
  config_load_ms: number;
  config_compile_ms: number;
  booking_cfg_load_ms: number;
  session_create_ms: number;
};

/** Lazy on first intake/book use — L1 → L2 → create with enrollment snapshot. */
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

  const l1 = getVoiceV2CallContext(canonical) || (sessionKey ? getVoiceV2CallContext(sessionKey) : null);
  input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: Boolean(l1) });
  if (l1) return l1;

  const fromStore = await loadVoiceV2CallContext(canonical);
  if (fromStore) {
    input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: true, source: "l2" });
    return fromStore;
  }

  input.trace?.mark("CONFIG_LOAD_START");
  const cfgStart = Date.now();
  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  input.trace?.mark("CONFIG_LOAD_END", { ms: Date.now() - cfgStart });

  input.trace?.mark("CONFIG_COMPILE_START");
  const compileStart = Date.now();
  const config = parseVoiceAgentConfig(runtime);
  const intakeSchema = compileVoiceV2IntakeSchema(config);
  input.trace?.mark("CONFIG_COMPILE_END", { ms: Date.now() - compileStart });

  input.trace?.mark("BOOKING_CFG_LOAD_START");
  const bookStart = Date.now();
  const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
  input.trace?.mark("BOOKING_CFG_LOAD_END", { ms: Date.now() - bookStart });
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";

  const enrollment = await buildVoiceV2EnrollmentSnapshot({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });

  input.trace?.mark("SESSION_CREATE_START");
  const createStart = Date.now();
  const cc = input.callControlId?.trim();
  const conv = input.conversationId?.trim();
  const payload: import("./types").VoiceV2CallContext = {
    sessionKey: canonical,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessTimezone: timezone,
    intakeSchema,
    intakeState: prefillPhone(input.fromE164),
    askedFields: {},
    compiledAt: new Date().toISOString(),
    intakeSaveCount: 0,
  };

  await createVoiceV2CallContext({
    payload,
    identity: {
      sessionKey: canonical,
      callId: input.callId?.trim() || canonical,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      telnyxCallControlId: cc || undefined,
      telnyxConversationId: conv || undefined,
    },
    enrollment,
  });

  setVoiceV2CallContext(payload);
  input.trace?.mark("SESSION_CREATE_END", { ms: Date.now() - createStart });
  return payload;
}
