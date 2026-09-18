import { resolveVoiceV3DefaultBusinessConfig } from "./resolve-business-config";
import { setVoiceV3CallContext } from "./session-store";
import { createEmptyVoiceV3CallContext, type VoiceV3CallContext } from "./types";

export function bootstrapVoiceV3CallContextForLiveSession(input: {
  liveSessionId: string;
  callId?: string | null;
  callerAniE164?: string | null;
  now?: Date;
}): VoiceV3CallContext {
  const business = resolveVoiceV3DefaultBusinessConfig();
  const sessionKey = `v3:${input.liveSessionId}`;
  const ctx = createEmptyVoiceV3CallContext({
    sessionKey,
    liveSessionId: input.liveSessionId,
    callId: input.callId ?? null,
    callerAniE164: input.callerAniE164 ?? null,
    business,
    now: input.now,
  });

  if (input.callerAniE164?.trim()) {
    const updatedAt = (input.now ?? new Date()).toISOString();
    ctx.intakeState.callback_phone = {
      value: input.callerAniE164.trim(),
      status: "CAPTURED",
      source: "SYSTEM",
      updatedAt,
      evidence: "PSTN ANI",
    };
  }

  setVoiceV3CallContext(ctx);
  return ctx;
}
