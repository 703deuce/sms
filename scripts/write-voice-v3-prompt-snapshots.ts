/**
 * Write full Voice V3 Amy + Astra prompt snapshots to docs/voice-v3-prompt-snapshots/.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/write-voice-v3-prompt-snapshots.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { applyMandatoryConversationGuardrails } from "@/lib/solutions/appointment-receptionist/conversation-guardrails";
import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import { compileVoiceV3AgentConfig } from "@/lib/voice-v3/config/compile-voice-v3-agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "@/lib/voice-v3/config/booking-agent-config";
import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import { buildVoiceV3Prompts } from "@/lib/voice-v3/prompts/build-voice-v3-prompts";
import { listVoiceV3AstraToolNamesForConfig } from "@/lib/voice-v3/tools/voice-tool-catalog";

const dir = "docs/voice-v3-prompt-snapshots";
const sep = "=".repeat(80);

function pack(label: string, cfg: VoiceV3AgentConfig) {
  const tools = listVoiceV3AstraToolNamesForConfig(cfg);
  const p = buildVoiceV3Prompts({ agentConfig: cfg, toolNames: tools });
  const body = [
    label,
    "Amy = buildLiveFrontendInstructions() | Astra = buildAstraBackendInstructions()",
    "Runtime: Amy gpt-live-1 | Astra gpt-6-luna (VOICE_V3_ASTRA_MODEL)",
    `Booking strategy: ${cfg.scheduling?.bookingStrategy ?? "unknown"}`,
    `Astra tools: ${tools.join(", ")}`,
    "",
    sep,
    "AMY — GPT-LIVE FRONTEND (amyInstructions)",
    sep,
    p.liveInstructions,
    "",
    sep,
    "ASTRA / LUNA — BACKEND (astraInstructions)",
    sep,
    p.astraInstructions,
    "",
  ].join("\n");
  return { body, tools };
}

function main() {
  mkdirSync(dir, { recursive: true });

  const wizard = applyMandatoryConversationGuardrails({
    ...createDefaultWizardState(),
    businessName: "Your Business Name",
    agentName: "Amy",
  });
  const wizardCfg = compileVoiceV3AgentConfig({
    wizard,
    providerConnections: {},
  });
  const wizardPack = pack(
    "WIZARD DEFAULT COMPILE (typical appointment receptionist before live M365 pin)",
    wizardCfg,
  );
  const certPack = pack(
    "CERT M365 BOOKING AGENT (VOICE_V3_BOOKING_AGENT_CONFIG)",
    VOICE_V3_BOOKING_AGENT_CONFIG,
  );

  writeFileSync(`${dir}/README.md`, [
    "# Voice V3 prompt snapshots",
    "",
    "Full Amy (GPT-Live frontend) + Astra/Luna (backend) instructions as compiled from this repo.",
    "",
    "| File | Use case |",
    "|------|----------|",
    "| [amy-and-astra-wizard-default.txt](./amy-and-astra-wizard-default.txt) | Wizard defaults + guardrails |",
    "| [amy-and-astra-cert-m365.txt](./amy-and-astra-cert-m365.txt) | Cert PSTN booking (M365 tools) |",
    "| [both-scenarios-combined.txt](./both-scenarios-combined.txt) | Both in one file |",
    "",
    "Regenerate:",
    "",
    "```bash",
    "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/write-voice-v3-prompt-snapshots.ts",
    "```",
    "",
  ].join("\n"));

  writeFileSync(`${dir}/amy-and-astra-wizard-default.txt`, wizardPack.body);
  writeFileSync(`${dir}/amy-and-astra-cert-m365.txt`, certPack.body);
  writeFileSync(
    `${dir}/both-scenarios-combined.txt`,
    `${wizardPack.body}\n\n${"#".repeat(80)}\n\n${certPack.body}`,
  );

  console.log("Wrote docs/voice-v3-prompt-snapshots/");
}

main();
