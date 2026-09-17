/**
 * Live OpenAI adapter → existing Voice V2 tool executors (same booking engine as Realtime/Telnyx).
 */
import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_CANCEL_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_FIND_EXISTING_TOOL_TYPE,
  VOICE_V2_RESCHEDULE_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
  VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
} from "@/lib/voice-v2/telnyx-tool-definition";
import {
  buildVoiceV2CallCapabilitySnapshot,
  type VoiceV2CallCapabilitySnapshot,
} from "@/lib/voice-v2/workflow-capability";
import { formatVoiceV2TelnyxToolResponse } from "@/lib/voice-v2/telnyx-response";
import { formatVoiceV2BookTelnyxResponse } from "@/lib/voice-v2/telnyx-book-response";
import { formatVoiceV2SaveIntakeTelnyxResponse } from "@/lib/voice-v2/telnyx-save-intake-response";
import { executeMicrosoft365CertifiedFindAvailability } from "@/lib/voice-v2/pipelines/microsoft-365-certified";
import { executeVoiceV2FindAvailability } from "@/lib/voice-v2/find-availability";
import { executeVoiceV2BookOfferedSlot } from "@/lib/voice-v2/book-offered-slot";
import { executeVoiceV2SaveIntakeFields } from "@/lib/voice-v2/intake/save-intake-fields";
import { executeVoiceV2FinalizeCallerRequest } from "@/lib/voice-v2/finalize-caller-request";
import { executeVoiceV2SendBookingLink } from "@/lib/voice-v2/send-booking-link";
import { executeVoiceV2SearchKnowledge } from "@/lib/voice-v2/search-knowledge";
import { executeVoiceV2TransferCall } from "@/lib/voice-v2/transfer-call";
import { VoiceV2TelnyxCallControlTransferProvider } from "@/lib/voice-v2/transfer/telnyx-transfer-provider";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { executeVoiceV2CreateCallbackRequest } from "@/lib/voice-v2/callback-request";
import { executeVoiceV2FindExistingAppointment } from "@/lib/voice-v2/appointment-changes/find-existing";
import { executeVoiceV2RescheduleAppointment } from "@/lib/voice-v2/appointment-changes/reschedule";
import { executeVoiceV2CancelAppointment } from "@/lib/voice-v2/appointment-changes/cancel";
import {
  applyBookResultToSessionState,
  applyFindResultToSessionState,
  createLiveBookingSessionState,
  mergeFindArgsWithSessionState,
  recordFindInvocation,
  type LiveBookingSessionState,
} from "./live-booking-session-state";
import {
  extractFindResultSlots,
  logFindInput,
  logFindResult,
  parseFindToolOutput,
} from "./live-find-trace";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";

export type LiveToolDispatchContext = {
  workspaceId: string;
  agentId: string;
  callId: string;
  callControlId: string;
  capability: VoiceV2CallCapabilitySnapshot;
  schedulingGeneration: number;
  onFindStarted?: (requestedDate: string) => void;
  /** Lazy-loaded on first tool dispatch (not at Live session.start). */
  agentConfigHydrated?: boolean;
  _hydratePromise?: Promise<void>;
  bookingSession: LiveBookingSessionState;
  onBookingStateChanged?: () => void;
};

export type LiveCallRuntimeContext = LiveToolDispatchContext;

function normalizeToolInvocationId(
  openAiCallId: string,
  args: Record<string, unknown>,
): string {
  const fromArgs = String(args.tool_invocation_id || args.toolInvocationId || "").trim();
  if (fromArgs) return fromArgs;
  return `live_${openAiCallId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
}

function compactToolResultForModel(
  toolName: string,
  result: Record<string, unknown>,
): string {
  if (toolName === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE) {
    return JSON.stringify(formatVoiceV2TelnyxToolResponse(result as never));
  }
  if (toolName === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE) {
    return JSON.stringify(formatVoiceV2BookTelnyxResponse(result as never));
  }
  if (toolName === VOICE_V2_SAVE_INTAKE_TOOL_TYPE) {
    return JSON.stringify(formatVoiceV2SaveIntakeTelnyxResponse(result as never));
  }
  return JSON.stringify(result);
}

const EXECUTOR_LABEL: Record<string, string> = {
  [VOICE_V2_SAVE_INTAKE_TOOL_TYPE]: "executeVoiceV2SaveIntakeFields",
  [VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE]: "executeMicrosoft365CertifiedFindAvailability|executeVoiceV2FindAvailability",
  [VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE]: "executeVoiceV2BookOfferedSlot",
  [VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE]: "executeVoiceV2FinalizeCallerRequest",
  [VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE]: "executeVoiceV2SendBookingLink",
  [VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE]: "executeVoiceV2SearchKnowledge",
  [VOICE_V2_TRANSFER_CALL_TOOL_TYPE]: "executeVoiceV2TransferCall",
  [VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE]: "executeVoiceV2CreateCallbackRequest",
  [VOICE_V2_FIND_EXISTING_TOOL_TYPE]: "executeVoiceV2FindExistingAppointment",
  [VOICE_V2_RESCHEDULE_TOOL_TYPE]: "executeVoiceV2RescheduleAppointment",
  [VOICE_V2_CANCEL_TOOL_TYPE]: "executeVoiceV2CancelAppointment",
};

export function liveToolExecutorLabel(toolName: string): string {
  return EXECUTOR_LABEL[toolName] || "unknown";
}

/**
 * Dispatch one Responses function call into the certified Voice V2 runtime.
 */
export async function ensureLiveToolDispatchContextHydrated(
  ctx: LiveToolDispatchContext,
): Promise<void> {
  if (ctx.agentConfigHydrated) return;
  if (!ctx._hydratePromise) {
    ctx._hydratePromise = (async () => {
      const t0 = Date.now();
      const runtime = await loadVoiceAgentRuntimeConfig(ctx.workspaceId, ctx.agentId);
      const config = parseVoiceAgentConfig(runtime);
      ctx.capability = buildVoiceV2CallCapabilitySnapshot(config);
      ctx.agentConfigHydrated = true;
      console.info(
        `LIVE_TOOL_CONTEXT_HYDRATE ${JSON.stringify({
          callId: ctx.callId,
          elapsed_ms: Date.now() - t0,
        })}`,
      );
    })();
  }
  await ctx._hydratePromise;
}

function toolUnavailable(speak: string, status: string): { output: string; executor: string } {
  return {
    executor: "capability_gate",
    output: JSON.stringify({ ok: false, speak, voice_v2_status: status }),
  };
}

export async function dispatchLiveVoiceTool(input: {
  toolName: string;
  args: Record<string, unknown>;
  openAiFunctionCallId: string;
  callContext: LiveToolDispatchContext;
}): Promise<{ output: string; discard?: boolean; executor: string }> {
  const { toolName, args, openAiFunctionCallId, callContext: ctx } = input;
  await ensureLiveToolDispatchContextHydrated(ctx);
  const strategy = ctx.capability.bookingStrategy;
  const executor = liveToolExecutorLabel(toolName);
  const body: Record<string, unknown> = {
    ...args,
    call_id: ctx.callId,
    conversation_id: ctx.callControlId,
    tool_invocation_id: normalizeToolInvocationId(openAiFunctionCallId, args),
  };

  if (toolName === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE) {
    if (!ctx.capability.findToolAvailable) {
      return toolUnavailable(
        "Live booking is not available on this line right now.",
        "FIND_DISABLED",
      );
    }
    const { merged, mergeNotes } = mergeFindArgsWithSessionState(args, ctx.bookingSession);
    const bookingCfg = await loadMctbAiBookingConfig(ctx.workspaceId);
    const timezone = bookingCfg.timezone?.trim() || "America/New_York";
    ctx.bookingSession.schedulingPreference.timezone = timezone;

    logFindInput({
      callId: ctx.callId,
      callerRawPreference: args,
      mergedPreference: merged,
      mergeNotes,
      timezone,
      bookingState: ctx.bookingSession,
    });

    recordFindInvocation(ctx.bookingSession, merged);
    const requestedDate = String(merged.requested_date || merged.requestedDate || "").trim();
    ctx.onFindStarted?.(requestedDate);

    const findBody: Record<string, unknown> = {
      ...body,
      ...merged,
      requested_date: merged.requested_date ?? merged.requestedDate,
    };

    const result =
      strategy === "MICROSOFT_365"
        ? await executeMicrosoft365CertifiedFindAvailability(findBody, ctx.workspaceId, {
            voiceCallId: ctx.callId,
          })
        : await executeVoiceV2FindAvailability(findBody, ctx.workspaceId, {
            voiceCallId: ctx.callId,
          });

    const formatted = compactToolResultForModel(toolName, result as Record<string, unknown>);
    const parsed = parseFindToolOutput(formatted);
    logFindResult({
      callId: ctx.callId,
      offerSetId: parsed.offer_set_id ? String(parsed.offer_set_id) : null,
      status: String(parsed.voice_v2_status || parsed.status || "ERROR"),
      slots: extractFindResultSlots(parsed),
      error: parsed.error ? String(parsed.error) : null,
    });
    applyFindResultToSessionState(ctx.bookingSession, parsed);
    ctx.onBookingStateChanged?.();

    return {
      executor,
      output: formatted,
    };
  }

  if (toolName === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE) {
    if (!ctx.capability.bookToolAvailable) {
      return toolUnavailable(
        "I cannot complete a booking on this line right now.",
        "BOOK_DISABLED",
      );
    }
    const result = await executeVoiceV2BookOfferedSlot(body, ctx.workspaceId, {
      agentId: ctx.agentId,
      certifiedPipeline: strategy === "MICROSOFT_365",
    });
    const formatted = compactToolResultForModel(toolName, result as Record<string, unknown>);
    applyBookResultToSessionState(ctx.bookingSession, parseFindToolOutput(formatted));
    ctx.onBookingStateChanged?.();
    return {
      executor,
      output: formatted,
    };
  }

  if (toolName === VOICE_V2_SAVE_INTAKE_TOOL_TYPE) {
    if (!ctx.capability.intakeToolAvailable) {
      return toolUnavailable("Intake is not enabled for this call.", "INTAKE_DISABLED");
    }
    const result = await executeVoiceV2SaveIntakeFields(body, ctx.workspaceId, ctx.agentId, {
      trustedPrismaCallId: ctx.callId,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE) {
    const result = await executeVoiceV2FinalizeCallerRequest({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callControlId: ctx.callControlId,
      conversationId: ctx.callControlId,
      voiceCallId: ctx.callId,
      summary: body.summary ? String(body.summary) : undefined,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE) {
    const result = await executeVoiceV2SendBookingLink({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callControlId: ctx.callControlId,
      conversationId: ctx.callControlId,
      voiceCallId: ctx.callId,
      raw: body,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE) {
    const result = await executeVoiceV2SearchKnowledge(body, ctx.workspaceId, ctx.agentId, {
      voiceCallId: ctx.callId,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_TRANSFER_CALL_TOOL_TYPE) {
    const runtime = await loadVoiceAgentRuntimeConfig(ctx.workspaceId, ctx.agentId);
    const config = parseVoiceAgentConfig(runtime);
    const handling = resolveAfterHoursHandlingFromAgentConfig(config);
    if (!handling?.transferEnabled) {
      return {
        executor,
        output: JSON.stringify({
          ok: false,
          speak: "Transfer is not available on this line.",
          voice_v2_status: "TRANSFER_DISABLED",
        }),
      };
    }
    const result = await executeVoiceV2TransferCall({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callControlId: ctx.callControlId,
      conversationId: ctx.callControlId,
      invocationId: normalizeToolInvocationId(openAiFunctionCallId, args),
      transferPlanId: body.transfer_plan_id ? String(body.transfer_plan_id) : undefined,
      callerRequested: body.caller_requested_human === true,
      destinationPhone: body.destination_phone ? String(body.destination_phone) : undefined,
      config: handling,
      provider: new VoiceV2TelnyxCallControlTransferProvider(),
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE) {
    const runtime = await loadVoiceAgentRuntimeConfig(ctx.workspaceId, ctx.agentId);
    const config = parseVoiceAgentConfig(runtime);
    const handling = resolveAfterHoursHandlingFromAgentConfig(config);
    if (!handling) {
      return {
        executor,
        output: JSON.stringify({
          ok: false,
          speak: "Callback is not configured.",
          voice_v2_status: "CALLBACK_DISABLED",
        }),
      };
    }
    const result = await executeVoiceV2CreateCallbackRequest({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callControlId: ctx.callControlId,
      conversationId: ctx.callControlId,
      voiceCallId: ctx.callId,
      invocationId: normalizeToolInvocationId(openAiFunctionCallId, args),
      callbackNumberOverride: body.callback_number ? String(body.callback_number) : undefined,
      callbackPreference: body.callback_preference ? String(body.callback_preference) : undefined,
      config: handling,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_FIND_EXISTING_TOOL_TYPE) {
    const result = await executeVoiceV2FindExistingAppointment(body, ctx.workspaceId, {
      voiceCallId: ctx.callId,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_RESCHEDULE_TOOL_TYPE) {
    const result = await executeVoiceV2RescheduleAppointment(body, ctx.workspaceId, {
      voiceCallId: ctx.callId,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  if (toolName === VOICE_V2_CANCEL_TOOL_TYPE) {
    const result = await executeVoiceV2CancelAppointment(body, ctx.workspaceId, {
      voiceCallId: ctx.callId,
    });
    return {
      executor,
      output: compactToolResultForModel(toolName, result as Record<string, unknown>),
    };
  }

  return {
    executor: "none",
    output: JSON.stringify({
      ok: false,
      speak: "That action is not available on this call.",
      error: "UNKNOWN_TOOL",
      tool: toolName,
    }),
  };
}

export function createLiveToolDispatchContext(input: {
  claims: {
    workspaceId: string;
    agentId: string;
    callId: string;
    callControlId: string;
  };
  config: VoiceAgentConfig;
}): LiveToolDispatchContext {
  return createLiveToolDispatchContextFromClaims(input.claims, input.config);
}

/** Stream claims only — agent config loaded on first tool call. */
export function createLiveToolDispatchContextFromClaims(
  claims: {
    workspaceId: string;
    agentId: string;
    callId: string;
    callControlId: string;
  },
  config?: VoiceAgentConfig,
): LiveToolDispatchContext {
  let lastFindDate = "";
  let lastFindGeneration = 0;
  const capability = buildVoiceV2CallCapabilitySnapshot(config ?? {});
  const ctx: LiveToolDispatchContext = {
    workspaceId: claims.workspaceId,
    agentId: claims.agentId,
    callId: claims.callId,
    callControlId: claims.callControlId,
    capability,
    schedulingGeneration: 0,
    bookingSession: createLiveBookingSessionState(),
    agentConfigHydrated: Boolean(config),
    onFindStarted: (requestedDate) => {
      if (requestedDate && requestedDate !== lastFindDate) {
        lastFindDate = requestedDate;
        lastFindGeneration += 1;
        ctx.schedulingGeneration = lastFindGeneration;
      }
    },
  };
  return ctx;
}
