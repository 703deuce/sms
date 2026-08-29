/**
 * Populate Amy's wizard with Harbor Drain Pros company facts in the system prompt,
 * sync Company Brain, and republish to Telnyx (TeXML route preserved).
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/amy-populate-company-knowledge.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { buildBusinessKnowledgePromptSection } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { applyHarborDrainProsWizardKnowledge } from "../src/lib/receptionist-wizard/harbor-drain-pros-config";
import { syncCompanyBrainFromWizard } from "../src/lib/agents/appointment-booking/sync-company-brain-from-wizard";
import { restoreTexmlInboundRoute } from "../src/lib/telephony/provisioning/number-assignment";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";

function loadWizardFromConfig(config: Record<string, unknown>): AppointmentReceptionistWizardState {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const stored = advanced.appointmentReceptionistWizard as
    | Partial<AppointmentReceptionistWizardState>
    | undefined;
  return {
    ...createDefaultWizardState(),
    ...(stored || {}),
  } as AppointmentReceptionistWizardState;
}

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Amy agent ${AMY_AGENT_ID} not found`);

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const prevRecord = prev as Record<string, unknown>;
  const wizard = applyHarborDrainProsWizardKnowledge(loadWizardFromConfig(prevRecord));
  const draftConfig = buildWizardAgentConfig(wizard);

  const knowledgeBlock = buildBusinessKnowledgePromptSection(wizard);
  const systemPrompt = String(
    (draftConfig.instructions as { system?: string } | undefined)?.system || "",
  );

  console.log("=== Harbor Drain Pros knowledge patch ===");
  console.log(
    JSON.stringify(
      {
        businessName: wizard.businessName,
        knowledgeItemCount: wizard.knowledgeItems.filter((k) => k.status === "complete").length,
        knowledgeBlockPreview: knowledgeBlock.slice(0, 400),
        systemPromptIncludesBusiness: systemPrompt.includes("Harbor Drain Pros"),
        systemPromptIncludesHours: /Monday/i.test(systemPrompt),
        systemPromptIncludesServices: /drain cleaning/i.test(systemPrompt),
      },
      null,
      2,
    ),
  );

  if (!knowledgeBlock.includes("Harbor Drain Pros")) {
    throw new Error("Knowledge block missing Harbor Drain Pros — aborting publish");
  }

  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, { draftConfig });
  await syncCompanyBrainFromWizard(WORKSPACE_ID, wizard);

  console.log("\n=== Publish (Telnyx assistant sync) ===");
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "populate-company-knowledge-prompt",
  );
  console.log(
    JSON.stringify(
      {
        agent: published.agent.name,
        version: published.version.version,
        telnyxAssistantId: published.agent.telnyxAssistantId,
        texmlRoute: published.texmlRoute,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Ensure TeXML inbound ===");
  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });
  if (!restored.ok) {
    throw new Error(`TeXML route restore failed for ${PHONE_E164}`);
  }
  console.log(JSON.stringify(restored, null, 2));

  console.log(`\nDone. Call ${PHONE_E164} and ask "What do you guys do?" — Amy should answer from the prompt.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
