import type { VoiceV3AgentConfig } from "../../src/lib/voice-v3/config/agent-config";

/**
 * Scripts-only fixture for dynamic-intake unit tests (odd field keys).
 * Never imported from src/ — not part of PSTN / Live accept / booking runtime.
 */
export const ODD_INTAKE_HARNESS_AGENT_CONFIG: VoiceV3AgentConfig = {
  businessName: "Transovo Test",
  timezone: "America/New_York",
  intakeFields: [
    {
      key: "name",
      label: "Name",
      type: "text",
      required: true,
      description: "The caller's full name.",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      required: true,
      description: "The caller's email address.",
      collectionStrategy: "voice_email",
      verificationRequired: false,
    },
    {
      key: "mothers_name",
      label: "Mother's name",
      type: "text",
      required: true,
      description: "The name of the caller's mother as provided by the caller.",
    },
    {
      key: "favorite_dinosaur",
      label: "Favorite dinosaur",
      type: "text",
      required: false,
      description: "The caller's favorite dinosaur.",
    },
  ],
  service: {
    id: "consultation",
    name: "Consultation",
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
    connectionId: "harness_unit_test_connection",
    calendarIds: ["primary"],
    smtp: null,
  },
};
