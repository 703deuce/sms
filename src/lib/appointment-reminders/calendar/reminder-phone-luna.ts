import "server-only";

import type { ProviderCalendarEvent } from "@/lib/calendar/providers";
import { arAiReschedulerModelOptions } from "@/lib/appointment-reminders/ai-rescheduler/model";
import { openAiChatJsonResponse } from "@/lib/appointment-reminders/ai-rescheduler/v3-workflow/openai-tools";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  validateLunaPhoneExtraction,
  type LunaPhoneExtractionPayload,
  type LunaReminderPhoneResult,
} from "@/lib/appointment-reminders/calendar/reminder-phone-evidence";
import { buildAppointmentEventSourceTexts, eventLocationText } from "@/lib/appointment-reminders/calendar/reminder-phone-content";

const LUNA_SYSTEM = `You are Luna, a precise extraction assistant for Appointment Reminders.

Identify the customer's phone number from a calendar appointment. Examine every field in the user message, including HTML description text.

Rules:
- The customer is the person receiving the service/appointment (not the business, staff, organizer, or conferencing bridge).
- If multiple numbers exist, return the one that belongs to the customer.
- Return supporting evidence: a short quote from the appointment that contains the number.
- If no customer phone can be identified from the appointment content, set found to false and number_role to none.
- Never invent or guess a number that does not appear in the appointment text.`;

const JSON_SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    phone: { type: ["string", "null"] },
    source_field: { type: ["string", "null"] },
    evidence: { type: ["string", "null"] },
    number_role: {
      type: "string",
      enum: ["customer", "business", "organizer", "conference", "unknown", "none"],
    },
  },
  required: ["found", "number_role"],
  additionalProperties: false,
} as const;

function formatEventForLuna(event: ProviderCalendarEvent): string {
  const attendees =
    event.attendees?.map((a) => ({
      name: a.name || null,
      email: a.email || null,
      responseStatus: a.responseStatus || null,
    })) ?? [];

  return JSON.stringify(
    {
      subject: event.summary || "",
      description_html: event.description || "",
      description_plain: (event.description || "").replace(/<[^>]+>/g, " "),
      location: eventLocationText(event),
      organizer_email: event.organizerEmail || null,
      attendees,
      timezone: event.timezone || null,
      status: event.status,
      is_all_day: event.isAllDay ?? false,
      updated_at: event.updatedAt?.toISOString() || null,
    },
    null,
    2,
  );
}

export async function lunaExtractCustomerPhoneFromCalendarEvent(
  event: ProviderCalendarEvent,
): Promise<LunaReminderPhoneResult> {
  const sourceTexts = buildAppointmentEventSourceTexts(event);
  const userContent = `Appointment fields (JSON):\n${formatEventForLuna(event)}`;

  let parsed: unknown;
  try {
    parsed = await openAiChatJsonResponse({
      ...arAiReschedulerModelOptions(),
      reasoningEffort: "low",
      schemaName: "ar_calendar_customer_phone",
      jsonSchema: JSON_SCHEMA,
      messages: [
        { role: "system", content: LUNA_SYSTEM },
        { role: "user", content: userContent },
      ],
      maxTokens: 400,
    });
  } catch {
    return { ok: false, reason: "luna_api_error" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "luna_empty_response" };
  }

  const payload = parsed as LunaPhoneExtractionPayload;
  const validated = validateLunaPhoneExtraction(payload, sourceTexts);
  if (!validated.ok) {
    return { ok: false, reason: validated.reason };
  }

  try {
    const e164 = normalizeE164(validated.phone);
    if (!e164) return { ok: false, reason: "luna_invalid_e164" };
    return {
      ok: true,
      e164,
      sourceField: payload.source_field?.trim() || null,
      evidence: payload.evidence?.trim() || null,
    };
  } catch {
    return { ok: false, reason: "luna_normalize_failed" };
  }
}
