import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import { resolveSessionKey } from "./intake/load-call-context";
import { getVoiceV2CallContext } from "./intake/session-store";
import { isTrustedPrismaVoiceCallId } from "./intake/resolve-trusted-call-id";
import {
  loadVoiceV2CallContext,
  resolveVoiceV2SessionKey,
} from "./session/call-context-store";

/**
 * Optional reschedule context for FIND — L1 then Redis/L2 via canonical aliases.
 * Must not throw when context is absent (new booking).
 */
export async function resolveVoiceV2ContextForFind(input: {
  callControlId?: string | null;
  conversationId?: string | null;
  trustedPrismaCallId?: string | null;
}): Promise<VoiceV2CallContext | null> {
  const callControlId = input.callControlId?.trim() || null;
  const conversationId = input.conversationId?.trim() || null;
  const trusted = input.trustedPrismaCallId?.trim() || null;
  const prismaCallId =
    trusted && isTrustedPrismaVoiceCallId(trusted) ? trusted : null;

  const sessionKey = resolveSessionKey({ callControlId, conversationId });
  const canonical = await resolveVoiceV2SessionKey({
    callControlId,
    conversationId,
    callId: prismaCallId,
  });

  const lookupKeys = [
    canonical,
    sessionKey,
    prismaCallId ? `call:${prismaCallId}` : null,
  ].filter(Boolean) as string[];

  for (const key of lookupKeys) {
    const fromL2 = await loadVoiceV2CallContext(key);
    if (fromL2) return fromL2;
    const l1 = getVoiceV2CallContext(key);
    if (l1) return l1;
  }

  return null;
}
