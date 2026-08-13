/**
 * Assign Summit Electric receptionist to 866 and republish (steals DID from other agents).
 * Usage: npx tsx scripts/reactivate-receptionist-866.ts
 */
import { getPrisma } from "../src/lib/db";
import { wizardStateFromDraftConfig } from "../src/lib/receptionist-wizard/load-config";
import { advancedFromDraftConfig } from "../src/lib/receptionist-wizard/load-advanced";
import { RECEPTIONIST_ADVANCED_KEY } from "../src/lib/receptionist-wizard/advanced-types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
} from "../src/lib/voice/receptionist/compile";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = "cmsqtfphh336n4a4q5v4u1a2t";
const PHONE_ID = "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = "+18663464256";
const VOICE_ID = process.env.VOICE_ID?.trim() || "shimmer";
const VOICE_LABEL = process.env.VOICE_LABEL?.trim() || "Shimmer";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error("Receptionist agent not found");

  const state = wizardStateFromDraftConfig(agent.draftConfig, AGENT_ID, agent.name);
  state.voiceId = VOICE_ID as typeof state.voiceId;
  state.voiceLabel = VOICE_LABEL;

  const advanced = advancedFromDraftConfig(agent.draftConfig, state.capabilities);
  const prev = parseVoiceAgentConfig(agent.draftConfig);

  const snapshot = compileReceptionistConfig({
    agentName: state.agentName,
    businessName: state.businessName,
    businessDescription: state.businessDescription,
    greeting: state.greeting,
    language: state.language,
    timezone: state.timezone,
    answerTiming: state.answerTiming,
    capabilities: state.capabilities,
    collectFields: state.collectFields,
    voiceId: VOICE_ID,
    voiceLabel: VOICE_LABEL,
    advanced: {
      [RECEPTIONIST_ADVANCED_KEY]: advanced,
      receptionistWizard: state,
    },
  });

  const merged = applyCompiledToVoiceConfig(prev, snapshot);
  const draftConfig = {
    ...merged,
    advanced: {
      ...(merged.advanced as object),
      receptionistWizard: state,
      [RECEPTIONIST_ADVANCED_KEY]: advanced,
      realtimeVoice: snapshot.voiceId,
    },
  };

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, {
    phoneNumberId: PHONE_ID,
    draftConfig,
  });

  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AGENT_ID,
    "reactivate-receptionist-866",
  );

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_ID, workspaceId: WORKSPACE_ID },
    select: { e164: true, settingsJson: true },
  });

  const ver = await prisma.voiceAgentVersion.findUnique({
    where: { id: published.version.id },
    select: { config: true },
  });
  const cfg = ver?.config as {
    voiceLanguage?: { voiceId?: string };
    advanced?: { realtimeVoice?: string; receptionistCompiled?: { businessName?: string } };
  };

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId: AGENT_ID,
        agentName: published.agent.name,
        status: published.agent.status,
        phoneE164: phone?.e164 || PHONE_E164,
        dispatchAgentId: phone?.settingsJson?.telephony?.explicitDispatch?.agentId,
        publishedVersionId: published.version.id,
        voiceId: cfg?.voiceLanguage?.voiceId,
        realtimeVoice: cfg?.advanced?.realtimeVoice,
        businessName: cfg?.advanced?.receptionistCompiled?.businessName,
        livekitProvision: published.livekitProvision,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
