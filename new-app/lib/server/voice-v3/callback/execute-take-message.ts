import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { toolOk, voiceToolError, type VoiceToolResult } from "../tools/types";
import { resolveCallbackCallerName, resolveCallbackPhoneE164 } from "./callback-requirements";
import { persistVoiceV3CallbackRequest } from "./persist-voice-v3-callback-request";
import type { TakeMessageArgs } from "../tools/take-message-tool";

export type ExecuteTakeMessageInput = {
  workspaceId: string;
  agentId: string | null;
  config: VoiceV3AgentConfig;
  context: VoiceV3CallContext;
  args: TakeMessageArgs;
};

export type ExecuteTakeMessageOutput = {
  result: VoiceToolResult;
  nextContext: VoiceV3CallContext;
};

function buildMessageIdempotencyKey(input: {
  callId: string;
  message: string;
  configVersion: string;
}): string {
  const msg = input.message.trim().toLowerCase().slice(0, 160);
  return `v3msg:${input.callId}:${input.configVersion}:${msg}`;
}

export async function executeTakeMessage(
  input: ExecuteTakeMessageInput,
): Promise<ExecuteTakeMessageOutput> {
  const { config, context, args } = input;
  let ctx = context;

  const message = args.message?.trim();
  if (!message) {
    return {
      result: voiceToolError("INVALID_ARGUMENTS", "Message text is required.", {}, "not_ready"),
      nextContext: ctx,
    };
  }

  const callbackPhone = resolveCallbackPhoneE164(config, ctx, {
    callback_phone: args.callback_phone,
    reason: message,
    preferred_time: null,
    notes: message,
    phone_confirmed: true,
  });

  if (!callbackPhone) {
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: ["phone"],
      }),
      nextContext: ctx,
    };
  }

  const callerName =
    args.caller_name?.trim() || resolveCallbackCallerName(ctx) || null;

  const configVersion = config.configVersion?.trim() || "v1";
  const idempotencyKey = buildMessageIdempotencyKey({
    callId: ctx.callId,
    message,
    configVersion,
  });

  const reasonParts = [message];
  if (args.caller_name?.trim()) {
    reasonParts.unshift(`From ${args.caller_name.trim()}:`);
  }
  const reason = reasonParts.join(" ").trim();

  const persistResult = await persistVoiceV3CallbackRequest({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: ctx.callId,
    liveSessionId: ctx.liveSessionId,
    callerName,
    inboundAni: ctx.telephony.inboundCallerE164 ?? null,
    callbackPhoneE164: callbackPhone,
    reason,
    preferredTime: null,
    notes: message,
    customFieldsSnapshot: { messageTaking: true },
    idempotencyKey,
    businessE164: config.telephony.phoneNumberE164,
    phoneNumberId: config.telephony.phoneNumberId,
    sourceRoute: "voice_v3_take_message",
  });

  if (!persistResult.ok) {
    return {
      result: voiceToolError(
        "PERSIST_FAILED",
        persistResult.message,
        { status: "failed" },
        "failed",
        persistResult.retryable,
      ),
      nextContext: ctx,
    };
  }

  ctx = {
    ...ctx,
    updatedAt: new Date().toISOString(),
    dialog: { ...ctx.dialog, activeGoal: "TAKE_MESSAGE" },
  };

  if (!persistResult.duplicate && persistResult.callbackRequestId) {
    void (async () => {
      try {
        const { projectVoiceV3CallbackOntoCall } = await import("./project-call-outcome");
        const { notifyVoiceV3CallbackRequested } = await import(
          "../notifications/notify-callback-requested"
        );
        await projectVoiceV3CallbackOntoCall({
          callId: ctx.callId,
          callbackRequestId: persistResult.callbackRequestId!,
          reason,
        });
        await notifyVoiceV3CallbackRequested({
          config,
          workspaceId: input.workspaceId,
          callId: ctx.callId,
          callbackRequestId: persistResult.callbackRequestId!,
          callerName,
          callerPhone: callbackPhone,
          reason,
          collectedLines: [message],
        });
      } catch (err) {
        console.error("VOICE_V3_TAKE_MESSAGE_POST_PERSIST_HOOK_FAILED", {
          callId: ctx.callId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  return {
    result: toolOk("message_recorded", {
      status: "message_recorded",
      callbackRequestId: persistResult.callbackRequestId,
    }),
    nextContext: ctx,
  };
}
