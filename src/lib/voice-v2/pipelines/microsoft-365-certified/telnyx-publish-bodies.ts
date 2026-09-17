/**
 * Telnyx webhook JSON schemas for Microsoft 365 certified FIND/BOOK only.
 * Duplicated intentionally — do not import Calendly or shared VOICE_V2_*_BODY constants.
 */
import { strictWebhookBodyParameters } from "@/lib/voice/schema/strict-tool-schema";

export const MICROSOFT_365_CERTIFIED_FIND_AVAILABILITY_BODY = strictWebhookBodyParameters({
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

export const MICROSOFT_365_CERTIFIED_BOOK_OFFERED_SLOT_BODY = strictWebhookBodyParameters({
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
