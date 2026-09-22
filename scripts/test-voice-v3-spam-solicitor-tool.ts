import assert from "node:assert/strict";
import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import {
  buildVoiceV3AstraFunctionToolsFromCatalog,
  listVoiceV3AstraToolNamesForConfig,
} from "@/lib/voice-v3/tools/voice-tool-catalog";
import { buildAstraBackendInstructions } from "@/lib/voice-v3/prompts/astra-backend-instructions";

function minimalConfig(spam: {
  spamLikelyPolicy: "ALLOW" | "SCREEN" | "BLOCK" | null;
  solicitorPolicy: "ALLOW" | "DECLINE" | "TAKE_MESSAGE" | null;
}): VoiceV3AgentConfig {
  return {
    workspaceId: "ws_test",
    agentId: "agent_test",
    businessName: "Test Biz",
    timezone: "America/New_York",
    capabilities: {
      bookAppointments: false,
      checkAvailability: false,
      findAppointments: false,
      rescheduleAppointments: false,
      cancelAppointments: false,
      transferCalls: false,
      answerQuestions: true,
      takeMessages: true,
    },
    spamProtection: spam,
    scheduling: { bookingStrategy: "NONE" },
    intakeFields: [],
    service: { id: "svc", name: "Service", durationMinutes: 30 },
    identity: { agentName: "Amy" },
    callHandling: { callbackRequestsEnabled: true },
  } as VoiceV3AgentConfig;
}

async function main() {
  const decline = minimalConfig({ spamLikelyPolicy: "SCREEN", solicitorPolicy: "DECLINE" });
  const names = listVoiceV3AstraToolNamesForConfig(decline);
  assert.ok(names.includes("report_unwanted_solicitor"), names.join(","));

  const allow = minimalConfig({ spamLikelyPolicy: "ALLOW", solicitorPolicy: "ALLOW" });
  const allowNames = listVoiceV3AstraToolNamesForConfig(allow);
  assert.ok(!allowNames.includes("report_unwanted_solicitor"));

  const astra = buildAstraBackendInstructions({ agentConfig: decline });
  assert.ok(astra.includes("report_unwanted_solicitor"));
  assert.ok(astra.includes("UNWANTED SALES / SOLICITORS"));

  buildVoiceV3AstraFunctionToolsFromCatalog(decline);
  console.log("test-voice-v3-spam-solicitor-tool: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
