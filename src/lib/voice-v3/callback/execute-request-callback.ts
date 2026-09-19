import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { toolOk, voiceToolError, type VoiceToolResult } from "../tools/types";
import {
  getMissingCallbackRequirementKeys,
  resolveCallbackCallerName,
  resolveCallbackPhoneE164,
  resolveCallbackReasonText,
} from "./callback-requirements";
import { persistVoiceV3CallbackRequest } from "./persist-voice-v3-callback-request";
import type {
  RequestCallbackToolArgs,
  VoiceV3CallbackCallState,
  VoiceV3CallbackPersistResult,
} from "./types";

export type RequestCallbackDeps = {
  persist?: (input: import("./types").VoiceV3CallbackPersistInput) => Promise<VoiceV3CallbackPersistResult>;
};

function initialCallbackState(): VoiceV3CallbackCallState {
  return {
    idempotencyKey: null,
    callbackRequestId: null,
    callbackPhone: null,
    preferredTime: null,
  };
}

function callbackFromContext(ctx: VoiceV3CallContext): VoiceV3CallbackCallState {
  return ctx.callback ?? initialCallbackState();
}

function withCallback(
  ctx: VoiceV3CallContext,
  patch: Partial<VoiceV3CallbackCallState>,
): VoiceV3CallContext {
  const base = callbackFromContext(ctx);
  return {
    ...ctx,
    updatedAt: new Date().toISOString(),
    callback: { ...base, ...patch },
    dialog: { ...ctx.dialog, activeGoal: "REQUEST_CALLBACK" },
  };
}

function buildIdempotencyKey(input: {
  callId: string;
  callbackPhone: string;
  reason: string | null;
  configVersion: string;
}): string {
  const reasonPart = (input.reason ?? "").trim().toLowerCase().slice(0, 120);
  return `v3cb:${input.callId}:${input.callbackPhone}:${input.configVersion}:${reasonPart}`;
}

function intakeSnapshot(ctx: VoiceV3CallContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(ctx.intake.values)) {
    if (!field?.value?.trim()) continue;
    out[key] = {
      value: field.value,
      source: field.source,
      updatedAt: field.updatedAt,
    };
  }
  return out;
}

export type ExecuteRequestCallbackInput = {
  workspaceId: string;
  agentId: string | null;
  config: VoiceV3AgentConfig;
  context: VoiceV3CallContext;
  args: RequestCallbackToolArgs;
  deps?: RequestCallbackDeps;
};

export type ExecuteRequestCallbackOutput = {
  result: VoiceToolResult;
  nextContext: VoiceV3CallContext;
};

export async function executeRequestCallback(
  input: ExecuteRequestCallbackInput,
): Promise<ExecuteRequestCallbackOutput> {
  const { config, context, args } = input;
  let ctx = context;

  console.log("VOICE_V3_CALLBACK_REQUEST_STARTED", {
    callId: ctx.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  if (!config.callHandling.callbackRequestsEnabled) {
    return {
      result: toolOk("not_available", { status: "not_available" }),
      nextContext: ctx,
    };
  }

  const missing = getMissingCallbackRequirementKeys(config, ctx, args);
  if (missing.length > 0) {
    console.log("VOICE_V3_CALLBACK_REQUIREMENTS_MISSING", {
      callId: ctx.callId,
      missingFields: missing,
    });
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: missing,
      }),
      nextContext: ctx,
    };
  }

  const callbackPhone = resolveCallbackPhoneE164(config, ctx, args);
  if (!callbackPhone) {
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: ["phone"],
      }),
      nextContext: ctx,
    };
  }

  const reason = resolveCallbackReasonText(config, ctx, args);
  const callerName = resolveCallbackCallerName(ctx);
  const preferredTime = args.preferred_time?.trim() || null;

  const configVersion = config.configVersion?.trim() || "unknown";
  const idempotencyKey = buildIdempotencyKey({
    callId: ctx.callId,
    callbackPhone,
    reason,
    configVersion,
  });

  const prior = callbackFromContext(ctx);
  if (prior.callbackRequestId && prior.idempotencyKey === idempotencyKey) {
    console.log("VOICE_V3_CALLBACK_TOOL_SUCCEEDED", {
      callId: ctx.callId,
      duplicate: true,
      callbackRequestId: prior.callbackRequestId,
    });
    return {
      result: toolOk("callback_requested", {
        status: "callback_requested",
        callbackRequestId: prior.callbackRequestId,
        callbackPhone: prior.callbackPhone ?? callbackPhone,
        preferredTime: prior.preferredTime,
      }),
      nextContext: ctx,
    };
  }

  const persistFn = input.deps?.persist ?? persistVoiceV3CallbackRequest;
  const persistResult = await persistFn({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: ctx.callId,
    liveSessionId: ctx.liveSessionId,
    callerName,
    inboundAni: ctx.telephony.inboundCallerE164,
    callbackPhoneE164: callbackPhone,
    reason,
    preferredTime: preferredTime ?? null,
    notes: args.notes?.trim() || null,
    customFieldsSnapshot: intakeSnapshot(ctx),
    idempotencyKey,
    businessE164: config.telephony.phoneNumberE164,
    phoneNumberId: config.telephony.phoneNumberId,
  });

  if (!persistResult.ok) {
    return {
      result: voiceToolError(
        "CALLBACK_PERSIST_FAILED",
        persistResult.message,
        { status: "failed" },
        "failed",
        persistResult.retryable,
      ),
      nextContext: ctx,
    };
  }

  ctx = withCallback(ctx, {
    idempotencyKey,
    callbackRequestId: persistResult.callbackRequestId,
    callbackPhone,
    preferredTime: preferredTime ?? null,
  });

  console.log("VOICE_V3_CALLBACK_TOOL_SUCCEEDED", {
    callId: ctx.callId,
    duplicate: persistResult.duplicate,
    callbackRequestId: persistResult.callbackRequestId,
  });

  return {
    result: toolOk("callback_requested", {
      status: "callback_requested",
      callbackRequestId: persistResult.callbackRequestId,
      callbackPhone,
      preferredTime: preferredTime ?? null,
    }),
    nextContext: ctx,
  };
}
