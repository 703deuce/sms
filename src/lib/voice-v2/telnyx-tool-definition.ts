import { strictWebhookBodyParameters } from "@/lib/voice/schema/strict-tool-schema";

export const VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE = "voice_v2_find_availability";
export const VOICE_V2_TELNYX_TOOL_NAME = "transovo-voice-v2-find-availability";
export const VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE = "voice_v2_book_offered_slot";
export const VOICE_V2_BOOK_TELNYX_TOOL_NAME = "transovo-voice-v2-book-offered-slot";
export const VOICE_V2_SAVE_INTAKE_TOOL_TYPE = "voice_v2_save_intake_fields";
export const VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME = "transovo-voice-v2-save-intake-fields";

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
    workflow_signal: {
      type: "string",
      description:
        "Structured workflow only: prefer_callback when caller wants a callback; cancel_booking when they abandon scheduling.",
      enum: ["prefer_callback", "cancel_booking"],
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
        "Save enabled intake field values the caller actually provided (built-in and custom wizard field keys). Do not call this for booking intent alone or for a scheduling date/time by itself — remember scheduling in conversation and use voice_v2_find_availability when intake is complete. If several intake values arrive in one utterance, save them together in one call.",
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
