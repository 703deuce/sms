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

/** PRELOAD_ONCE_PER_CALL — lazy on first intake/book use, then memoized. */
export async function ensureVoiceV2CallContext(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
}): Promise<VoiceV2CallContext | null> {
  const sessionKey = resolveSessionKey(input);
  if (!sessionKey) return null;

  const existing = getVoiceV2CallContext(sessionKey);
  if (existing) return existing;

  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";

  const ctx: VoiceV2CallContext = {
    sessionKey,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessTimezone: timezone,
    intakeSchema: compileVoiceV2IntakeSchema(config),
    intakeState: prefillPhone(input.fromE164),
    askedFields: {},
    compiledAt: new Date().toISOString(),
  };
  setVoiceV2CallContext(ctx);
  return ctx;
}
