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
};
