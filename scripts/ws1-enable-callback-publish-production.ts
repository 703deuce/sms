#!/usr/bin/env npx tsx
/**
 * Enable callback on ws_1 wizard + publish. Does not change booking strategy or SEND_LINK fields.
 */
import { getPrisma } from "../src/lib/db";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { ensureCallbackRequiredCollectFieldIds } from "../src/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error("Agent not found");

  const loaded = await loadAppointmentReceptionistSetup(WORKSPACE_ID, { agentId: AGENT_ID });
  if (!loaded?.state) throw new Error("Wizard state missing");
  const state = loaded.state as AppointmentReceptionistWizardState;

  const priorStrategy =
    state.bookingBehavior?.bookingStrategy ?? state.bookingStrategy ?? null;

  state.callbackRequestsEnabled = true;
  state.callbackRequiredCollectFieldIds = ensureCallbackRequiredCollectFieldIds(state);

  const draftConfig = buildWizardAgentConfig(state);
  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, { draftConfig });
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AGENT_ID,
    "voice-v3-callback-pstn-cert-enable",
  );

  console.log(
    "WS1_CALLBACK_PUBLISH_OK",
    JSON.stringify({
      publishedVersion: published.version.version,
      bookingStrategyUnchanged: priorStrategy,
      callbackRequestsEnabled: true,
      callbackRequiredCollectFieldIds: state.callbackRequiredCollectFieldIds,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
