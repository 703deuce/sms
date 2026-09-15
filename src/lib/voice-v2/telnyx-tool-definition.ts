import { strictWebhookBodyParameters } from "@/lib/voice/schema/strict-tool-schema";

export const VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE = "voice_v2_find_availability";
export const VOICE_V2_TELNYX_TOOL_NAME = "transovo-voice-v2-find-availability";

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
