import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import {
  buildVoiceV3AstraFunctionToolsFromCatalog,
  listVoiceV3AstraToolNamesForConfig,
} from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { isVoiceV3ToolAuthorized } from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

const wizard = {
  solutionName: "Test",
  businessName: "Acme Request",
  agentName: "Sam",
  capabilities: ["book_appointments", "collect_intake"],
  bookingStrategy: "REQUEST_ONLY",
  appointmentTypes: [
    {
      id: "svc1",
      name: "Consult",
      durationMin: 30,
      enabled: true,
      bookingPermission: "request_only",
    },
  ],
  collectFields: [
    { id: "f1", key: "name", label: "Name", type: "text", required: true },
    { id: "f2", key: "phone", label: "Phone", type: "phone", required: true },
  ],
  knowledgeItems: [],
} as AppointmentReceptionistWizardState;

const config = compileVoiceV3AgentConfig({
  wizard,
  envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
});

assert.equal(config.scheduling.bookingStrategy, "REQUEST_ONLY");

const names = listVoiceV3AstraToolNamesForConfig(config);
assert.ok(names.includes("submit_appointment_request"));
assert.ok(!names.includes("find_availability"));
assert.ok(!names.includes("book_appointment"));

assert.ok(isVoiceV3ToolAuthorized(config, "submit_appointment_request"));
assert.ok(!isVoiceV3ToolAuthorized(config, "book_appointment"));

const tools = buildVoiceV3AstraFunctionToolsFromCatalog(config).map((t) => t.name);
assert.ok(tools.includes("submit_appointment_request"));

console.log("test-voice-v3-request-only: PASS");
