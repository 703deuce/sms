#!/usr/bin/env npx tsx
/**
 * Enable wizard cancel + reschedule capabilities and publish appointment receptionist.
 * DB path — no browser session required.
 */
import { getPrisma } from "../src/lib/db";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { routePhoneToVoiceV3BasicCallControl } from "../src/lib/voice-v3/provisioning/route-phone-to-voice-v3-basic";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const AGENT_ID =
  process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";

function enableManagementCaps(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  const caps = new Set(state.capabilities || []);
  caps.add("reschedule");
  caps.add("cancel");
  if (!caps.has("book_appointments")) {
    caps.add("book_appointments");
  }
  return {
    ...state,
    agentId: AGENT_ID,
    capabilities: [...caps],
    activationMode: "activate_now",
  };
}

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: { phoneNumber: { select: { id: true, e164: true, providerNumberId: true } } },
  });
  if (!agent) {
    throw new Error(`Agent ${AGENT_ID} not found in ${WORKSPACE_ID}`);
  }

  const loaded = await loadAppointmentReceptionistSetup(WORKSPACE_ID, { agentId: AGENT_ID });
  if (!loaded?.state) {
    throw new Error("Could not load appointment receptionist wizard state");
  }

  const before = (loaded.state as AppointmentReceptionistWizardState).capabilities || [];
  const state = enableManagementCaps(loaded.state as AppointmentReceptionistWizardState);
  const draftConfig = buildWizardAgentConfig(state);

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, { draftConfig });
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AGENT_ID,
    "enable-cancel-reschedule-publish",
  );

  const v3 = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    publishedVersionId: published.version.id,
  });

  let route: Awaited<ReturnType<typeof routePhoneToVoiceV3BasicCallControl>> | null = null;
  if (agent.phoneNumber?.e164) {
    route = await routePhoneToVoiceV3BasicCallControl({
      e164: agent.phoneNumber.e164,
      providerNumberId: agent.phoneNumber.providerNumberId,
      workspaceId: WORKSPACE_ID,
      phoneNumberId: agent.phoneNumber.id,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_ID,
        phoneE164: agent.phoneNumber?.e164 ?? null,
        capabilitiesBefore: before,
        capabilitiesAfter: state.capabilities,
        v3Capabilities: v3.capabilities,
        publishedVersion: published.version.version,
        deploymentStatus: published.version.deploymentStatus,
        telnyxRoute: route
          ? {
              matched: route.matched,
              path: route.path,
              connectionId: route.connectionId,
            }
          : null,
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
