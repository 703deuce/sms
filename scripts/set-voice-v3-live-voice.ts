#!/usr/bin/env npx tsx
/**
 * Set GPT-Live voice on an appointment-receptionist (Voice V3) agent and republish.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     WORKSPACE_ID=ws_1 VOICE_AGENT_ID=... LIVE_VOICE=gleam \
 *     npx tsx scripts/set-voice-v3-live-voice.ts
 */
import { getPrisma } from "../src/lib/db";
import { publishVoiceAgent, updateVoiceAgentDraft } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { normalizeVoiceV3LiveBuiltInVoice } from "../src/lib/voice-v3/config/voice-v3-live-built-in-voices";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim();
const LIVE_VOICE = normalizeVoiceV3LiveBuiltInVoice(
  process.env.LIVE_VOICE?.trim() || "gleam",
  "LIVE_VOICE",
);

async function main() {
  if (!AGENT_ID) {
    throw new Error("VOICE_AGENT_ID required");
  }

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, draftConfig: true, sourceSolutionSetupId: true },
  });
  if (!agent) throw new Error(`Agent ${AGENT_ID} not found in ${WORKSPACE_ID}`);

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const advanced = { ...(config.advanced || {}) } as Record<string, unknown>;
  const prevWizard = (advanced.appointmentReceptionistWizard ||
    {}) as AppointmentReceptionistWizardState;
  const wizard: AppointmentReceptionistWizardState = {
    ...prevWizard,
    voiceId: LIVE_VOICE,
    voiceLabel: LIVE_VOICE.charAt(0).toUpperCase() + LIVE_VOICE.slice(1),
    voiceSource: "builtin",
    openAiCustomVoiceId: null,
  };
  advanced.appointmentReceptionistWizard = wizard;

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, {
    draftConfig: {
      ...config,
      advanced,
      voiceLanguage: {
        ...(config.voiceLanguage || {}),
        voiceId: LIVE_VOICE,
      },
    },
  });

  if (agent.sourceSolutionSetupId) {
    const setup = await prisma.solutionSetup.findFirst({
      where: { id: agent.sourceSolutionSetupId, workspaceId: WORKSPACE_ID },
      select: { id: true, stateJson: true },
    });
    if (setup?.stateJson && typeof setup.stateJson === "object") {
      const state = {
        ...(setup.stateJson as Record<string, unknown>),
        voiceId: LIVE_VOICE,
        voiceLabel: wizard.voiceLabel,
        voiceSource: "builtin",
        openAiCustomVoiceId: null,
      };
      await prisma.solutionSetup.update({
        where: { id: setup.id },
        data: { stateJson: state as object },
      });
    }
  }

  const built = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, "set-voice-v3-live-voice");
  const v3 = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });

  console.log(
    JSON.stringify(
      {
        agentId: AGENT_ID,
        agentName: agent.name,
        liveVoice: LIVE_VOICE,
        publishedVersion: built.version.version,
        runtimeLiveVoiceId: v3.telephony?.liveVoiceId,
      },
      null,
      2,
    ),
  );

  if (v3.telephony?.liveVoiceId !== LIVE_VOICE) {
    throw new Error(
      `Runtime liveVoiceId is ${v3.telephony?.liveVoiceId}, expected ${LIVE_VOICE}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
