import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import { compileVoiceV2IntakeSchema } from "./compile-schema";
import { setVoiceV2CallContext, getVoiceV2CallContext } from "./session-store";
import type { IntakeFieldStatus, VoiceV2CallContext, VoiceV2IntakeState } from "./types";

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

/** PRELOAD_ONCE_PER_CALL — lazy on first intake/book use, then memoized. */
export async function ensureVoiceV2CallContext(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  trace?: import("./save-intake-trace").SaveIntakeTrace;
}): Promise<VoiceV2CallContext | null> {
  const sessionKey = resolveSessionKey(input);
  if (!sessionKey) return null;

  input.trace?.mark("CALL_CONTEXT_LOOKUP_START");
  const existing = getVoiceV2CallContext(sessionKey);
  input.trace?.mark("CALL_CONTEXT_LOOKUP_END", { cache_hit: Boolean(existing) });
  if (existing) return existing;

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

  input.trace?.mark("SESSION_CREATE_START");
  const ctx: VoiceV2CallContext = {
    sessionKey,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessTimezone: timezone,
    intakeSchema,
    intakeState: prefillPhone(input.fromE164),
    askedFields: {},
    compiledAt: new Date().toISOString(),
    intakeSaveCount: 0,
  };
  setVoiceV2CallContext(ctx);
  input.trace?.mark("SESSION_CREATE_END");
  return ctx;
}
