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
  VOICE_V2_BOOK_OFFERED_SLOT_BODY,
  VOICE_V2_CANCEL_BODY,
  VOICE_V2_CREATE_CALLBACK_REQUEST_BODY,
  VOICE_V2_FINALIZE_CALLER_REQUEST_BODY,
  VOICE_V2_FIND_AVAILABILITY_BODY,
  VOICE_V2_FIND_EXISTING_BODY,
  VOICE_V2_RESCHEDULE_BODY,
  VOICE_V2_SAVE_INTAKE_BODY,
  VOICE_V2_SEARCH_KNOWLEDGE_BODY,
  VOICE_V2_SEND_BOOKING_LINK_BODY,
  VOICE_V2_TRANSFER_CALL_BODY,
} from "@/lib/voice-v2/telnyx-tool-definition";
import {
  buildVoiceV2CallCapabilitySnapshot,
  type VoiceV2CallCapabilitySnapshot,
} from "@/lib/voice-v2/workflow-capability";
import { resolveVoiceV2BookingStrategy } from "@/lib/voice-v2/pstn-workflow-mode";
import { formatVoiceV2TelnyxToolResponse } from "@/lib/voice-v2/telnyx-response";
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
import { isVoiceV2KnowledgeSearchEnabled } from "@/lib/voice-v2/knowledge-config";

export type OpenAiRealtimeFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

function fnTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): OpenAiRealtimeFunctionTool {
  return { type: "function", name, description, parameters };
}

export function buildOpenAiRealtimeVoiceV2Tools(input: {
  config: VoiceAgentConfig;
  transferEnabled?: boolean;
}): OpenAiRealtimeFunctionTool[] {
  const snap = buildVoiceV2CallCapabilitySnapshot(input.config);
  const strategy = resolveVoiceV2BookingStrategy(input.config);
  const tools: OpenAiRealtimeFunctionTool[] = [];

  if (snap.intakeToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
        "Save enabled intake field values the caller provided. Not for booking intent alone or date/time alone.",
        VOICE_V2_SAVE_INTAKE_BODY as Record<string, unknown>,
      ),
    );
  }

  if (snap.findToolAvailable) {
    const findSchema =
      strategy === "CALENDLY"
        ? VOICE_V2_FIND_AVAILABILITY_BODY
        : VOICE_V2_FIND_AVAILABILITY_BODY;
    tools.push(
      fnTool(
        VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
        "Structured FIND_AVAILABILITY — send business-local date and time window. Only state slots returned.",
        findSchema as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
        "Book using offer_set_id and selected_slot_id from FIND. Only say confirmed after BOOKING_CONFIRMED.",
        VOICE_V2_BOOK_OFFERED_SLOT_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_FIND_EXISTING_TOOL_TYPE,
        "Find caller's existing appointment for reschedule or cancel.",
        VOICE_V2_FIND_EXISTING_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_RESCHEDULE_TOOL_TYPE,
        "Reschedule to a canonical offered slot.",
        VOICE_V2_RESCHEDULE_BODY as Record<string, unknown>,
      ),
    );
    tools.push(
      fnTool(
        VOICE_V2_CANCEL_TOOL_TYPE,
        "Cancel after caller explicitly confirmed.",
        VOICE_V2_CANCEL_BODY as Record<string, unknown>,
      ),
    );
  }

  if (snap.finalizeToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
        "Finalize a caller request for the business when not live booking.",
        VOICE_V2_FINALIZE_CALLER_REQUEST_BODY as Record<string, unknown>,
      ),
    );
  }

  if (snap.sendBookingLinkToolAvailable) {
    tools.push(
      fnTool(
        VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
        "Text booking link after verbal SMS consent.",
        VOICE_V2_SEND_BOOKING_LINK_BODY as Record<string, unknown>,
      ),
    );
  }

  if (isVoiceV2KnowledgeSearchEnabled(input.config)) {
    tools.push(
      fnTool(
        VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
        "Search indexed business documents when answer is not in prompt.",
        VOICE_V2_SEARCH_KNOWLEDGE_BODY as Record<string, unknown>,
      ),
    );
  }

  if (input.transferEnabled) {
    tools.push(
      fnTool(
        VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
        "Transfer to a human when caller requests and policy allows.",
        VOICE_V2_TRANSFER_CALL_BODY as Record<string, unknown>,
      ),
    );
  }

  tools.push(
    fnTool(
      VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
      "Create a callback request when caller prefers callback.",
      VOICE_V2_CREATE_CALLBACK_REQUEST_BODY as Record<string, unknown>,
    ),
  );

  return tools;
}

export type RealtimeToolDispatchContext = {
  workspaceId: string;
  agentId: string;
  callId: string;
  callControlId: string;
  capability: VoiceV2CallCapabilitySnapshot;
  schedulingGeneration: number;
  onFindStarted?: (requestedDate: string) => void;
};

function normalizeToolInvocationId(
  openAiCallId: string,
  args: Record<string, unknown>,
): string {
  const fromArgs = String(args.tool_invocation_id || args.toolInvocationId || "").trim();
  if (fromArgs) return fromArgs;
  return `rt_${openAiCallId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
}

function compactToolResultForModel(result: Record<string, unknown>): string {
  const payload = formatVoiceV2TelnyxToolResponse(result as never);
  return JSON.stringify(payload);
}

/**
 * Protocol-only adapter: invokes existing Voice V2 executors (same as Telnyx webhooks).
 */
export async function dispatchOpenAiRealtimeVoiceV2Tool(input: {
  toolName: string;
  args: Record<string, unknown>;
  openAiFunctionCallId: string;
  ctx: RealtimeToolDispatchContext;
}): Promise<{ output: string; discard?: boolean }> {
  const { toolName, args, openAiFunctionCallId, ctx } = input;
  const strategy = ctx.capability.bookingStrategy;
  const body: Record<string, unknown> = {
    ...args,
    call_id: ctx.callId,
    conversation_id: ctx.callControlId,
    tool_invocation_id: normalizeToolInvocationId(openAiFunctionCallId, args),
  };

  if (toolName === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE) {
    const requestedDate = String(args.requested_date || args.requestedDate || "").trim();
    ctx.onFindStarted?.(requestedDate);
    const result =
      strategy === "MICROSOFT_365"
        ? await executeMicrosoft365CertifiedFindAvailability(body, ctx.workspaceId, {
            voiceCallId: ctx.callId,
          })
        : await executeVoiceV2FindAvailability(body, ctx.workspaceId, {
            voiceCallId: ctx.callId,
          });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE) {
    const result = await executeVoiceV2BookOfferedSlot(body, ctx.workspaceId, {
      agentId: ctx.agentId,
      certifiedPipeline: strategy === "MICROSOFT_365",
    });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_SAVE_INTAKE_TOOL_TYPE) {
    const result = await executeVoiceV2SaveIntakeFields(body, ctx.workspaceId, ctx.agentId, {
      trustedPrismaCallId: ctx.callId,
    });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
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
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
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
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE) {
    const result = await executeVoiceV2SearchKnowledge(body, ctx.workspaceId, ctx.agentId, {
      voiceCallId: ctx.callId,
    });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_TRANSFER_CALL_TOOL_TYPE) {
    const runtime = await loadVoiceAgentRuntimeConfig(ctx.workspaceId, ctx.agentId);
    const config = parseVoiceAgentConfig(runtime);
    const handling = resolveAfterHoursHandlingFromAgentConfig(config);
    if (!handling?.transferEnabled) {
      return {
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
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE) {
    const runtime = await loadVoiceAgentRuntimeConfig(ctx.workspaceId, ctx.agentId);
    const config = parseVoiceAgentConfig(runtime);
    const handling = resolveAfterHoursHandlingFromAgentConfig(config);
    if (!handling) {
      return {
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
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_FIND_EXISTING_TOOL_TYPE) {
    const result = await executeVoiceV2FindExistingAppointment(body, ctx.workspaceId, {
      voiceCallId: ctx.callId,
    });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_RESCHEDULE_TOOL_TYPE) {
    const result = await executeVoiceV2RescheduleAppointment(body, ctx.workspaceId, {
      voiceCallId: ctx.callId,
    });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  if (toolName === VOICE_V2_CANCEL_TOOL_TYPE) {
    const result = await executeVoiceV2CancelAppointment(body, ctx.workspaceId, {
      voiceCallId: ctx.callId,
    });
    return { output: compactToolResultForModel(result as Record<string, unknown>) };
  }

  return {
    output: JSON.stringify({
      ok: false,
      speak: "That action is not available on this call.",
      error: "tool_not_exposed",
    }),
  };
}
