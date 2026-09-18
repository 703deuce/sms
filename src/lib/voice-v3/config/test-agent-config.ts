import type { VoiceV3AgentConfig } from "./agent-config";

/** Intentionally odd fields — proves dynamic capture without special-case code. */
export const TEST_AGENT_CONFIG: VoiceV3AgentConfig = {
  businessName: "Transovo Test",
  timezone: "America/New_York",
  intakeFields: [
    {
      key: "name",
      label: "Name",
      type: "text",
      required: true,
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      required: true,
    },
    {
      key: "mothers_name",
      label: "Mother's name",
      type: "text",
      required: true,
    },
    {
      key: "favorite_dinosaur",
      label: "Favorite dinosaur",
      type: "text",
      required: false,
    },
  ],
  service: {
    durationMinutes: 60,
    slotStepMinutes: 30,
  },
  businessHours: {
    weekdays: [1, 2, 3, 4, 5],
    startLocal: "09:00",
    endLocal: "17:00",
  },
  calendar: {
    provider: "microsoft",
    connectionId: process.env.VOICE_V3_TEST_MICROSOFT_CONNECTION_ID?.trim() || "test_connection",
    calendarIds: [process.env.VOICE_V3_TEST_CALENDAR_ID?.trim() || "primary"],
    smtp: process.env.VOICE_V3_TEST_MICROSOFT_SMTP?.trim() || null,
  },
};
