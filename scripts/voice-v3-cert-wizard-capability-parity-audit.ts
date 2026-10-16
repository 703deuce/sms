#!/usr/bin/env npx tsx
/**
 * Emit JSON capability parity matrix (cert reference vs wizard scenarios).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-v3-cert-wizard-capability-parity-audit.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import {
  compileScenario,
  type ParityScenarioId,
  toolMatrixForConfigs,
  VOICE_V3_PARITY_TOOL_ORDER,
} from "../src/lib/voice-v3/config/capability-parity-audit";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "../src/lib/voice-v3/tools/voice-tool-catalog";

const SCENARIOS: ParityScenarioId[] = [
  "cert_m365_reference",
  "wizard_default_request_only",
  "wizard_microsoft_365_direct",
  "wizard_send_booking_link",
  "wizard_booking_disabled",
];

function main(): void {
  const cert = compileScenario("cert_m365_reference");
  const rows = SCENARIOS.map((id) => {
    const config = compileScenario(id);
    const tools = listVoiceV3AstraToolNamesForConfig(config);
    const openAiTools = buildVoiceV3AstraFunctionToolsFromCatalog(config);
    return {
      scenario: id,
      bookingStrategy: config.scheduling?.bookingStrategy ?? null,
      transferEnabled: config.transfer?.enabled === true,
      transferDestinations: config.transferDestinations?.length ?? 0,
      calendarConnectionId: config.calendar?.connectionId ?? null,
      compiledTools: tools,
      openAiToolSchemaCount: openAiTools.length,
      matrixVsCert: toolMatrixForConfigs(cert, config),
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    note:
      "Compiled-layer parity only. Python LiveKit registration mirrors toolSchemas from resolveVoiceV3LiveKitSession. Live M365 book/cancel requires prod calendar + PSTN smoke (BLOCKED without DATABASE_URL).",
    toolCatalog: [...VOICE_V3_PARITY_TOOL_ORDER],
    scenarios: rows,
  };

  const json = JSON.stringify(summary, null, 2);
  console.log(json);
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  writeFileSync("/opt/cursor/artifacts/voice-v3-capability-parity-audit.json", json);
}

main();
