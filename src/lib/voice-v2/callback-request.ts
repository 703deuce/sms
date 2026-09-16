import "server-only";

import { getVoiceV2CallContext, setVoiceV2CallContext } from "./intake/session-store";
import { resolveSessionKey } from "./intake/load-call-context";
import { intakeFieldValue } from "./deterministic-rules";
import type { VoiceV2PublishedAfterHoursHandlingConfig } from "./after-hours-handling-types";
import { deliverVoiceV2BusinessRequestNotifications } from "./business-request-notifications";

export type CreateCallbackRequestInput = {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  voiceCallId?: string | null;
  invocationId: string;
  callbackNumberOverride?: string;
  callbackPreference?: string;
  config: VoiceV2PublishedAfterHoursHandlingConfig;
};

export type CreateCallbackRequestResult =
  | {
      status: "CALLBACK_REQUESTED";
      outcome: "CALLBACK_REQUESTED";
      speak: string;
      voice_v2_status: "CALLBACK_REQUESTED";
    }
  | {
      status: "CALLBACK_DISABLED";
      speak: string;
      voice_v2_status: "CALLBACK_DISABLED";
    }
  | {
      status: "SESSION_UNAVAILABLE";
      speak: string;
      voice_v2_status: "SESSION_UNAVAILABLE";
    };

export async function executeVoiceV2CreateCallbackRequest(
  input: CreateCallbackRequestInput,
): Promise<CreateCallbackRequestResult> {
  if (!input.config.callbackRequestsEnabled) {
    return {
      status: "CALLBACK_DISABLED",
      speak: "Callback requests are not enabled on this line.",
      voice_v2_status: "CALLBACK_DISABLED",
    };
  }

  const sessionKey = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });
  if (!sessionKey) {
    return {
      status: "SESSION_UNAVAILABLE",
      speak: "I could not save the callback request.",
      voice_v2_status: "SESSION_UNAVAILABLE",
    };
  }
  const ctx = getVoiceV2CallContext(sessionKey);
  if (!ctx) {
    return {
      status: "SESSION_UNAVAILABLE",
      speak: "I could not save the callback request.",
      voice_v2_status: "SESSION_UNAVAILABLE",
    };
  }

  const prior = ctx.afterHours?.callback;
  if (
    prior?.requested &&
    prior.notificationGeneration === input.invocationId
  ) {
    return {
      status: "CALLBACK_REQUESTED",
      outcome: "CALLBACK_REQUESTED",
      speak: "Your callback request is already recorded.",
      voice_v2_status: "CALLBACK_REQUESTED",
    };
  }

  const ani =
    input.callbackNumberOverride?.trim() ||
    (input.config.callbackUseAniByDefault ? intakeFieldValue(ctx, "phone") : "") ||
    intakeFieldValue(ctx, "phone");
  const pref =
    input.callbackPreference?.trim() ||
    intakeFieldValue(ctx, "callback_preference") ||
    intakeFieldValue(ctx, "callback_time_preference");

  const nextCtx = {
    ...ctx,
    afterHours: {
      ...ctx.afterHours,
      callback: {
        requested: true,
        callbackNumber: ani || undefined,
        callbackPreference: pref || undefined,
        finalizedAt: new Date().toISOString(),
        notificationGeneration: input.invocationId,
      },
    },
  };
  setVoiceV2CallContext(nextCtx);

  if (input.voiceCallId) {
    void deliverVoiceV2BusinessRequestNotifications({
      workspaceId: input.workspaceId,
      callId: input.voiceCallId,
      outcome: "CALLBACK_REQUESTED",
      callerName: intakeFieldValue(ctx, "name"),
      callerPhone: ani,
      serviceReason:
        intakeFieldValue(ctx, "service_reason") || intakeFieldValue(ctx, "reason"),
      schedulingSummary: pref,
      customFields: {},
    }).catch(() => undefined);
  }

  return {
    status: "CALLBACK_REQUESTED",
    outcome: "CALLBACK_REQUESTED",
    speak: "Got it — someone will call you back.",
    voice_v2_status: "CALLBACK_REQUESTED",
  };
}
