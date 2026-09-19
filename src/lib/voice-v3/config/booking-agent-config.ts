import type { VoiceV3AgentConfig } from "./agent-config";
import { defaultNestedFromFlat } from "./default-nested-config";

const service = {
  id: process.env.VOICE_V3_SERVICE_ID?.trim() || "consultation",
  name: process.env.VOICE_V3_SERVICE_NAME?.trim() || "Consultation",
  durationMinutes: Number(process.env.VOICE_V3_SERVICE_DURATION_MINUTES || "60"),
  slotStepMinutes: Number(process.env.VOICE_V3_SERVICE_SLOT_STEP_MINUTES || "30"),
};

const nested = defaultNestedFromFlat({
  businessName: process.env.VOICE_V3_BUSINESS_NAME?.trim() || "Transovo",
  timezone: process.env.VOICE_V3_BUSINESS_TIMEZONE?.trim() || "America/New_York",
  service,
  agentName: process.env.VOICE_V3_AGENT_NAME?.trim() || "Amy",
});

/**
 * Canonical Voice V3 PSTN booking pipeline — GPT-Live + Astra + FIND/SELECT/BOOK.
 * Not the legacy Voice V2 book flow or odd-field intake test harness.
 */
export const VOICE_V3_BOOKING_AGENT_CONFIG: VoiceV3AgentConfig = {
  businessName: process.env.VOICE_V3_BUSINESS_NAME?.trim() || "Transovo",
  timezone: process.env.VOICE_V3_BUSINESS_TIMEZONE?.trim() || "America/New_York",
  intake: {
    objectiveDescription:
      "Collect enough caller information to service and schedule the request.",
  },
  intakeFields: [
    {
      key: "name",
      label: "Name",
      type: "text",
      required: true,
      description: "The caller's full name for the appointment.",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      required: true,
      description: "The caller's email address for appointment communication.",
      collectionStrategy: "voice_email",
      verificationRequired: false,
    },
    {
      key: "phone",
      label: "Phone",
      type: "phone",
      required: true,
      description: "The caller's phone number for appointment contact.",
      collectionStrategy: "voice_phone",
    },
  ],
  operationRequirements: {
    find_availability: [],
    book_appointment: ["name", "email", "phone"],
  },
  service,
  businessHours: {
    weekdays: [1, 2, 3, 4, 5],
    startLocal: process.env.VOICE_V3_BUSINESS_HOURS_START?.trim() || "09:00",
    endLocal: process.env.VOICE_V3_BUSINESS_HOURS_END?.trim() || "17:00",
  },
  calendar: {
    provider: "microsoft",
    connectionId: process.env.VOICE_V3_MICROSOFT_CONNECTION_ID?.trim() || "",
    calendarIds: [process.env.VOICE_V3_CALENDAR_ID?.trim() || "primary"],
    smtp: process.env.VOICE_V3_MICROSOFT_SMTP?.trim() || null,
  },
  ...nested,
  services: nested.services,
  source: "env_fallback",
};
