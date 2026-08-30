/**
 * Apply Telnyx-applicable voice architecture to Amy 866 and republish.
 * Does NOT touch LiveKit routing — TeXML → Telnyx assistant only.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/amy-apply-telnyx-voice-architecture.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { applyHarborDrainProsWizardKnowledge } from "../src/lib/receptionist-wizard/harbor-drain-pros-config";
import { buildVoiceConfigFingerprint } from "../src/lib/voice/config-fingerprint";
import { restoreTexmlInboundRoute } from "../src/lib/telephony/provisioning/number-assignment";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";

function loadWizard(config: Record<string, unknown>): AppointmentReceptionistWizardState {
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
  const wizard = applyHarborDrainProsWizardKnowledge(loadWizard(prev as Record<string, unknown>));
  const draftConfig = buildWizardAgentConfig(wizard);

  const fingerprintPreview = buildVoiceConfigFingerprint({
    config: draftConfig,
    agentVersionId: agent.publishedVersionId,
    runtimeProvider: "telnyx",
  });

  const systemPrompt = String(
    (draftConfig.instructions as { system?: string } | undefined)?.system || "",
  );

  console.log("=== Telnyx voice architecture patch ===");
  console.log(
    JSON.stringify(
      {
        voiceStability: draftConfig.voiceLanguage?.elevenLabsStability,
        voiceSimilarity: draftConfig.voiceLanguage?.elevenLabsSimilarityBoost,
        voiceStyle: draftConfig.voiceLanguage?.elevenLabsStyle,
        pronunciationNotes: draftConfig.instructions?.pronunciation?.slice(0, 80),
        latencyProfile: draftConfig.voiceTiming?.activeProfile,
        voiceArchitectureVersion: (draftConfig.advanced as Record<string, unknown>)
          ?.voiceArchitectureVersion,
        fingerprintPreview: fingerprintPreview.fingerprint,
        promptHasSpeechRules: /SPOKEN LANGUAGE|September third/i.test(systemPrompt) === false,
        constitutionHasSpeechRules: systemPrompt.includes("September third"),
      },
      null,
      2,
    ),
  );

  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, { draftConfig });

  console.log("\n=== Publish to Telnyx assistant ===");
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "telnyx-voice-architecture-v1",
  );

  const liveAssistantId = published.agent.telnyxAssistantId;
  let liveTools: string[] = [];
  if (liveAssistantId && ai.isTelnyxAiConfigured()) {
    const remote = await ai.getAssistant(liveAssistantId);
    const tools = (remote as { tools?: Array<{ type?: string; name?: string }> }).tools || [];
    liveTools = tools.map((t) => t.name || t.type || "?").filter(Boolean);
  }

  console.log(
    JSON.stringify(
      {
        version: published.version.version,
        telnyxAssistantId: liveAssistantId,
        texmlRoute: published.texmlRoute,
        liveToolCount: liveTools.length,
        liveTools,
        hasRuntimeTurn: liveTools.includes("runtime_turn"),
      },
      null,
      2,
    ),
  );

  if (liveTools.includes("runtime_turn")) {
    throw new Error("Live assistant still has runtime_turn — aborting");
  }

  console.log("\n=== Ensure TeXML inbound (not LiveKit) ===");
  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });
  if (!restored.ok) {
    throw new Error(`TeXML route restore failed for ${PHONE_E164}`);
  }
  console.log(JSON.stringify(restored, null, 2));

  console.log(`\nDone. Call ${PHONE_E164} — Amy on Telnyx TeXML with voice architecture v1.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
