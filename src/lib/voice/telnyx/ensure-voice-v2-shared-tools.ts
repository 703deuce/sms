import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import * as ai from "./ai-client";
import { TelnyxApiError } from "./ai-client";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_BODY,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
  VOICE_V2_FIND_EXISTING_BODY,
  VOICE_V2_FIND_EXISTING_TOOL_TYPE,
  VOICE_V2_FIND_EXISTING_TELNYX_TOOL_NAME,
  VOICE_V2_RESCHEDULE_BODY,
  VOICE_V2_RESCHEDULE_TOOL_TYPE,
  VOICE_V2_RESCHEDULE_TELNYX_TOOL_NAME,
  VOICE_V2_CANCEL_BODY,
  VOICE_V2_CANCEL_TOOL_TYPE,
  VOICE_V2_CANCEL_TELNYX_TOOL_NAME,
  VOICE_V2_FINALIZE_CALLER_REQUEST_BODY,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
  VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_SEND_BOOKING_LINK_BODY,
  VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
  VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME,
  VOICE_V2_SEARCH_KNOWLEDGE_BODY,
  VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
  VOICE_V2_SEARCH_KNOWLEDGE_TELNYX_TOOL_NAME,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TELNYX_TOOL_NAME,
  VOICE_V2_TRANSFER_CALL_BODY,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TELNYX_TOOL_NAME,
  VOICE_V2_CREATE_CALLBACK_REQUEST_BODY,
} from "@/lib/voice-v2/telnyx-tool-definition";
import type { VoiceV2BookingStrategy } from "@/lib/voice-v2/booking-strategy";
import { voiceV2StrategyAllowsFindBook } from "@/lib/voice-v2/booking-strategy";
import type { VoiceV2SharedToolIds } from "./voice-v2-shared-tools";
import {
  MICROSOFT_365_CERTIFIED_BOOK_OFFERED_SLOT_BODY,
  MICROSOFT_365_CERTIFIED_FIND_AVAILABILITY_BODY,
} from "@/lib/voice-v2/pipelines/microsoft-365-certified/telnyx-publish-bodies";
import {
  CALENDLY_VOICE_V2_BOOK_OFFERED_SLOT_BODY,
  CALENDLY_VOICE_V2_FIND_AVAILABILITY_BODY,
} from "@/lib/voice-v2/pipelines/calendly/telnyx-publish-bodies";

function unwrapToolId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const obj = res as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  const data = obj.data;
  if (data && typeof data === "object" && typeof (data as { id?: string }).id === "string") {
    return (data as { id: string }).id;
  }
  return null;
}

async function ensureSharedWebhookTool(input: {
  workspaceId: string;
  agentId: string;
  displayName: string;
  toolType: string;
  urlPath: string;
  bodyParameters: Record<string, unknown>;
  timeoutMs: number;
  description: string;
}): Promise<string> {
  const base = getAppBaseUrl();
  const url = `${base.replace(/\/$/, "")}${input.urlPath}`;
  const payload = {
    type: "webhook",
    display_name: input.displayName,
    webhook: {
      name: input.toolType,
      description: input.description,
      url,
      method: "POST",
      timeout_ms: input.timeoutMs,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
        { name: "X-Transovo-Agent-Id", value: input.agentId },
        { name: "X-Transovo-Tool-Type", value: input.toolType },
      ],
      body_parameters: input.bodyParameters,
    },
  };

  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const existing = tools.find((t) => t.display_name === input.displayName);
  if (existing?.id) {
    try {
      await ai.updateSharedTool(existing.id, payload);
      return existing.id;
    } catch (err) {
      if (!(err instanceof TelnyxApiError) || (err.status !== 404 && err.status !== 410)) {
        throw err;
      }
    }
  }
  const created = await ai.createSharedTool(payload);
  const id = unwrapToolId(created);
  if (!id) throw new Error("createSharedTool_missing_id");
  return id;
}

/** Idempotent — (re)create/update V2 shared tools from config authority, not Telnyx leftovers. */
export async function ensureVoiceV2SharedToolsForAgent(input: {
  workspaceId: string;
  agentId: string;
  bookingStrategy?: VoiceV2BookingStrategy;
  knowledgeBaseEnabled?: boolean;
  transferEnabled?: boolean;
  callbackRequestsEnabled?: boolean;
}): Promise<VoiceV2SharedToolIds> {
  const strategy = input.bookingStrategy ?? "MICROSOFT_365";
  const liveFindBook = voiceV2StrategyAllowsFindBook(strategy);
  const knowledgeEnabled = input.knowledgeBaseEnabled === true;

  const saveIntakeId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/save-intake-fields",
    bodyParameters: VOICE_V2_SAVE_INTAKE_BODY,
    timeoutMs: 5000,
    description: "Voice Booking V2: save caller intake fields in one call.",
  });

  const sendBookingLinkId =
    strategy === "SEND_LINK"
      ? await ensureSharedWebhookTool({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          displayName: VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME,
          toolType: VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE,
          urlPath: "/api/telnyx/voice-v2/send-booking-link",
          bodyParameters: VOICE_V2_SEND_BOOKING_LINK_BODY,
          timeoutMs: 12000,
          description:
            "Send the business configured booking link by SMS after caller agrees. URL comes from runtime config only.",
        })
      : null;

  const finalizeRequestId =
    strategy === "SEND_LINK"
      ? null
      : await ensureSharedWebhookTool({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          displayName: VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME,
          toolType: VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE,
          urlPath: "/api/telnyx/voice-v2/finalize-caller-request",
          bodyParameters: VOICE_V2_FINALIZE_CALLER_REQUEST_BODY,
          timeoutMs: 8000,
          description:
            "Accept caller message or appointment request for business follow-up (not live booking).",
        });

  const transferCallId =
    input.transferEnabled === true
      ? await ensureSharedWebhookTool({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          displayName: VOICE_V2_TRANSFER_CALL_TELNYX_TOOL_NAME,
          toolType: VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
          urlPath: "/api/telnyx/voice-v2/transfer-call",
          bodyParameters: VOICE_V2_TRANSFER_CALL_BODY,
          timeoutMs: 25000,
          description:
            "Use when the caller asks for a person or when configured urgency/human rules require it. Connect to the configured transfer plan only — set caller_requested_human true when the caller asked for a human. Never pass arbitrary phone numbers. If this tool is unavailable, use callback or message instead of continuing AI persuasion.",
        })
      : null;

  const createCallbackId =
    input.callbackRequestsEnabled === true
      ? await ensureSharedWebhookTool({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          displayName: VOICE_V2_CREATE_CALLBACK_REQUEST_TELNYX_TOOL_NAME,
          toolType: VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
          urlPath: "/api/telnyx/voice-v2/create-callback-request",
          bodyParameters: VOICE_V2_CREATE_CALLBACK_REQUEST_BODY,
          timeoutMs: 8000,
          description:
            "Record a callback request using caller context. Callback time is not an appointment.",
        })
      : null;

  const searchKnowledgeId = knowledgeEnabled
    ? await ensureSharedWebhookTool({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        displayName: VOICE_V2_SEARCH_KNOWLEDGE_TELNYX_TOOL_NAME,
        toolType: VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE,
        urlPath: "/api/telnyx/voice-v2/search-knowledge",
        bodyParameters: VOICE_V2_SEARCH_KNOWLEDGE_BODY,
        timeoutMs: 12000,
        description:
          "Search indexed business documents when the answer is not in the Business knowledge prompt section.",
      })
    : null;

  if (!liveFindBook) {
    return {
      findId: null,
      bookId: null,
      saveIntakeId,
      findExistingId: null,
      rescheduleId: null,
      cancelId: null,
      finalizeRequestId,
      sendBookingLinkId,
      searchKnowledgeId,
      transferCallId,
      createCallbackId,
    };
  }

  /** Dumb publish selector only — URLs + per-strategy Telnyx JSON schemas. No booking logic. */
  const findBookBase =
    strategy === "CALENDLY"
      ? "/api/telnyx/voice-v2/calendly"
      : "/api/telnyx/voice-v2";
  const findBody =
    strategy === "CALENDLY"
      ? CALENDLY_VOICE_V2_FIND_AVAILABILITY_BODY
      : MICROSOFT_365_CERTIFIED_FIND_AVAILABILITY_BODY;
  const bookBody =
    strategy === "CALENDLY"
      ? CALENDLY_VOICE_V2_BOOK_OFFERED_SLOT_BODY
      : MICROSOFT_365_CERTIFIED_BOOK_OFFERED_SLOT_BODY;

  const findId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
    urlPath: `${findBookBase}/find-availability`,
    bodyParameters: findBody,
    timeoutMs: 10000,
    description:
      strategy === "CALENDLY"
        ? "Voice Booking V2 (Calendly): structured FIND_AVAILABILITY only."
        : "Voice Booking V2 (Microsoft 365 certified): structured FIND_AVAILABILITY only.",
  });
  const bookId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_BOOK_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
    urlPath: `${findBookBase}/book-offered-slot`,
    bodyParameters: bookBody,
    timeoutMs: 15000,
    description:
      strategy === "CALENDLY"
        ? "Voice Booking V2 (Calendly): book using offer_set_id + selected_slot_id."
        : "Voice Booking V2 (Microsoft 365 certified): book using offer_set_id + selected_slot_id.",
  });
  const findExistingId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_FIND_EXISTING_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_FIND_EXISTING_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/find-existing-appointment",
    bodyParameters: VOICE_V2_FIND_EXISTING_BODY,
    timeoutMs: 10000,
    description: "Voice V2: find caller's existing appointment for reschedule or cancel.",
  });
  const rescheduleId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_RESCHEDULE_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_RESCHEDULE_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/reschedule-appointment",
    bodyParameters: VOICE_V2_RESCHEDULE_BODY,
    timeoutMs: 15000,
    description: "Voice V2: move existing appointment to a canonical offered slot.",
  });
  const cancelId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_CANCEL_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_CANCEL_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/cancel-appointment",
    bodyParameters: VOICE_V2_CANCEL_BODY,
    timeoutMs: 15000,
    description: "Voice V2: cancel an existing appointment after caller confirmation.",
  });
  return {
    findId,
    bookId,
    saveIntakeId,
    findExistingId,
    rescheduleId,
    cancelId,
    finalizeRequestId,
    sendBookingLinkId,
    searchKnowledgeId,
    transferCallId,
    createCallbackId,
  };
}
