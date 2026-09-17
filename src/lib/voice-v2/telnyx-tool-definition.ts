import { strictWebhookBodyParameters } from "@/lib/voice/schema/strict-tool-schema";

export const VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE = "voice_v2_find_availability";
export const VOICE_V2_TELNYX_TOOL_NAME = "transovo-voice-v2-find-availability";
export const VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE = "voice_v2_book_offered_slot";
export const VOICE_V2_BOOK_TELNYX_TOOL_NAME = "transovo-voice-v2-book-offered-slot";
export const VOICE_V2_SAVE_INTAKE_TOOL_TYPE = "voice_v2_save_intake_fields";
export const VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME = "transovo-voice-v2-save-intake-fields";
export const VOICE_V2_FIND_EXISTING_TOOL_TYPE = "voice_v2_find_existing_appointment";
export const VOICE_V2_FIND_EXISTING_TELNYX_TOOL_NAME =
  "transovo-voice-v2-find-existing-appointment";
export const VOICE_V2_RESCHEDULE_TOOL_TYPE = "voice_v2_reschedule_appointment";
export const VOICE_V2_RESCHEDULE_TELNYX_TOOL_NAME = "transovo-voice-v2-reschedule-appointment";
export const VOICE_V2_CANCEL_TOOL_TYPE = "voice_v2_cancel_appointment";
export const VOICE_V2_CANCEL_TELNYX_TOOL_NAME = "transovo-voice-v2-cancel-appointment";
export const VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE = "voice_v2_finalize_caller_request";
export const VOICE_V2_FINALIZE_CALLER_REQUEST_TELNYX_TOOL_NAME =
  "transovo-voice-v2-finalize-caller-request";
export const VOICE_V2_SEND_BOOKING_LINK_TOOL_TYPE = "voice_v2_send_booking_link";
export const VOICE_V2_SEND_BOOKING_LINK_TELNYX_TOOL_NAME =
  "transovo-voice-v2-send-booking-link";
export const VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE = "voice_v2_search_knowledge";
export const VOICE_V2_SEARCH_KNOWLEDGE_TELNYX_TOOL_NAME =
  "transovo-voice-v2-search-knowledge";
export const VOICE_V2_TRANSFER_CALL_TOOL_TYPE = "voice_v2_transfer_call";
export const VOICE_V2_TRANSFER_CALL_TELNYX_TOOL_NAME = "transovo-voice-v2-transfer-call";
export const VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE = "voice_v2_create_callback_request";
export const VOICE_V2_CREATE_CALLBACK_REQUEST_TELNYX_TOOL_NAME =
  "transovo-voice-v2-create-callback-request";

export const VOICE_V2_TRANSFER_CALL_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    tool_invocation_id: { type: "string" },
    transfer_plan_id: { type: "string" },
    caller_requested_human: { type: "boolean" },
    call_id: { type: "string" },
    conversation_id: { type: "string" },
  },
  required: ["tool_invocation_id"],
});

export const VOICE_V2_CREATE_CALLBACK_REQUEST_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    tool_invocation_id: { type: "string" },
    callback_number: { type: "string" },
    callback_preference: { type: "string" },
    call_id: { type: "string" },
    conversation_id: { type: "string" },
  },
  required: ["tool_invocation_id"],
});

export const VOICE_V2_SEND_BOOKING_LINK_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    recipient_phone: {
      type: "string",
      description:
        "Optional E.164 destination when different from caller ID. Omit to use the caller's number.",
    },
    verbal_sms_consent: {
      type: "boolean",
      description: "True after the caller agreed to receive the booking link by text.",
    },
    tool_invocation_id: { type: "string" },
    call_id: { type: "string" },
    conversation_id: { type: "string" },
  },
  required: [],
});

export const VOICE_V2_FINALIZE_CALLER_REQUEST_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Optional short summary of the caller request for the business.",
    },
    tool_invocation_id: { type: "string" },
    call_id: { type: "string" },
    conversation_id: { type: "string" },
  },
  required: [],
});

export const VOICE_V2_SAVE_INTAKE_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    fields: {
      type: "object",
      description:
        "Caller-provided intake values keyed by enabled field id from business configuration (built-in and custom wizard fields). Only keys enabled for this agent are accepted.",
      properties: {
        name: { type: "string" },
        email: {
          type: "string",
          description:
            "Email as user@domain.tld. Convert spoken forms (at, dot, spaced letters) before saving.",
        },
        phone: { type: "string" },
        address: { type: "string" },
        service_reason: { type: "string" },
      },
      additionalProperties: {
        type: "string",
        description: "Custom wizard intake field value when that field id is enabled for this call.",
      },
    },
    tool_invocation_id: {
      type: "string",
      description: "Unique id for this tool call",
    },
    booking_intent_active: {
      type: "boolean",
      description:
        "True when the caller is trying to schedule or continue booking (facts only — runtime chooses next stage).",
    },
    explicit_callback_requested: {
      type: "boolean",
      description:
        "True only when the caller explicitly asked for callback-only handling (not assistant suggestions).",
    },
    cancel_booking_requested: {
      type: "boolean",
      description: "True when the caller explicitly abandons scheduling on this call.",
    },
    intent_evidence: {
      type: "string",
      description: "Short quote from caller speech supporting explicit_callback or cancel flags.",
    },
    scheduling_preference: {
      type: "object",
      description: "Optional scheduling facts extracted from caller speech.",
      properties: {
        requested_date: { type: "string", description: "YYYY-MM-DD when known" },
        requested_day: { type: "string", description: "Spoken day e.g. Friday" },
        requested_daypart: { type: "string" },
        requested_time: { type: "string" },
      },
    },
  },
  required: ["fields"],
});

export const VOICE_V2_BOOK_OFFERED_SLOT_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    offer_set_id: {
      type: "string",
      description: "offer_set_id from AVAILABILITY_FOUND",
    },
    selected_slot_id: {
      type: "string",
      description: "Canonical slot_id from the same offer set only",
    },
    tool_invocation_id: {
      type: "string",
      description: "Unique id for idempotent booking",
    },
  },
  required: ["offer_set_id", "selected_slot_id"],
});

export const VOICE_V2_SEARCH_KNOWLEDGE_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    query: {
      type: "string",
      description:
        "Concise self-contained question for business documents (include conversational context when needed).",
    },
    tool_invocation_id: { type: "string" },
    call_id: { type: "string" },
    conversation_id: { type: "string" },
  },
  required: ["query"],
});

export const VOICE_V2_FIND_AVAILABILITY_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    requested_date: {
      type: "string",
      description: "Business-local calendar date YYYY-MM-DD",
    },
    time_window: {
      type: "object",
      description: "Business-local wall-clock window on requested_date",
      properties: {
        start: { type: "string", description: "HH:mm 24h local start" },
        end: { type: "string", description: "HH:mm 24h local end" },
      },
      required: ["start", "end"],
    },
    tool_invocation_id: {
      type: "string",
      description: "Unique id for this tool call",
    },
  },
  required: ["requested_date", "time_window"],
});

export const VOICE_V2_FIND_EXISTING_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    intent: { type: "string", enum: ["RESCHEDULE", "CANCEL"] },
    appointment_date: {
      type: "string",
      description: "Optional YYYY-MM-DD hint for which appointment",
    },
    tool_invocation_id: { type: "string" },
  },
});

export const VOICE_V2_RESCHEDULE_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    appointment_ref_id: { type: "string" },
    offer_set_id: { type: "string" },
    selected_slot_id: { type: "string" },
    tool_invocation_id: { type: "string" },
  },
  required: ["appointment_ref_id", "offer_set_id", "selected_slot_id"],
});

export const VOICE_V2_CANCEL_BODY = strictWebhookBodyParameters({
  type: "object",
  properties: {
    appointment_ref_id: { type: "string" },
    caller_confirmed: {
      type: "boolean",
      description: "True after caller explicitly confirmed cancellation",
    },
    tool_invocation_id: { type: "string" },
  },
  required: ["appointment_ref_id", "caller_confirmed"],
});

export function buildVoiceV2FindAvailabilityTelnyxWebhook(input: {
  webhookUrl: string;
  workspaceId: string;
  agentId: string;
}) {
  return {
    type: "webhook",
    name: VOICE_V2_TELNYX_TOOL_NAME,
    timeout_ms: 10000,
    webhook: {
      name: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
      description:
        "Voice Booking V2 proof: structured FIND_AVAILABILITY only. You interpret the caller; send date + local time window. Runtime queries Microsoft directly.",
      url: input.webhookUrl,
      method: "POST",
      timeout_ms: 10000,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
        { name: "X-Transovo-Agent-Id", value: input.agentId },
        { name: "X-Transovo-Tool-Type", value: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE },
      ],
      body_parameters: VOICE_V2_FIND_AVAILABILITY_BODY,
    },
  };
}

export function buildVoiceV2SaveIntakeFieldsTelnyxWebhook(input: {
  webhookUrl: string;
  workspaceId: string;
  agentId: string;
}) {
  return {
    type: "webhook",
    name: VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
    timeout_ms: 5000,
    webhook: {
      name: VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
      description:
        "Save enabled intake field values the caller actually provided (built-in and custom wizard field keys). Scheduling dates heard from the caller are persisted by the runtime — use scheduling_preference on this tool when you also need to correct or supply YYYY-MM-DD explicitly. Do not call for booking intent alone. Batch several new field values from one utterance in one call when possible.",
      url: input.webhookUrl,
      method: "POST",
      timeout_ms: 5000,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
        { name: "X-Transovo-Agent-Id", value: input.agentId },
        { name: "X-Transovo-Tool-Type", value: VOICE_V2_SAVE_INTAKE_TOOL_TYPE },
      ],
      body_parameters: VOICE_V2_SAVE_INTAKE_BODY,
    },
  };
}

export function buildVoiceV2BookOfferedSlotTelnyxWebhook(input: {
  webhookUrl: string;
  workspaceId: string;
  agentId: string;
}) {
  return {
    type: "webhook",
    name: VOICE_V2_BOOK_TELNYX_TOOL_NAME,
    timeout_ms: 15000,
    webhook: {
      name: VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
      description:
        "Voice Booking V2: book a slot from the active offer_set_id using selected_slot_id only. Do not send caller utterance.",
      url: input.webhookUrl,
      method: "POST",
      timeout_ms: 15000,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
        { name: "X-Transovo-Agent-Id", value: input.agentId },
        { name: "X-Transovo-Tool-Type", value: VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE },
      ],
      body_parameters: VOICE_V2_BOOK_OFFERED_SLOT_BODY,
    },
  };
}
