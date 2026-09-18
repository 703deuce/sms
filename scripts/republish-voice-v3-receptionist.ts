#!/usr/bin/env npx tsx
/**
 * Republish appointment receptionist + route DID to Voice V3 Basic Call Control.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     WORKSPACE_ID=ws_1 VOICE_AGENT_ID=... PHONE_E164=+1... \
 *     npx tsx scripts/republish-voice-v3-receptionist.ts
 *
 * If VOICE_AGENT_ID omitted, resolves ACTIVE agent on PHONE_E164 with capabilityPack appointment_receptionist.
 */
import { getPrisma } from "../src/lib/db";
import { publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { isAppointmentReceptionistAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { routePhoneToVoiceV3BasicCallControl } from "../src/lib/voice-v3/provisioning/route-phone-to-voice-v3-basic";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";

const PHONE_E164 = process.env.PHONE_E164?.trim() || "+15717491060";
const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const AGENT_ID =
  process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";

async function resolveAgent(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, phoneNumberId },
    orderBy: { updatedAt: "desc" },
  });
  for (const agent of agents) {
    const cfg = parseVoiceAgentConfig(agent.draftConfig);
    if (isAppointmentReceptionistAgent(cfg)) return agent;
    const adv = (cfg.advanced || {}) as Record<string, unknown>;
    if (adv.capabilityPack === "appointment_receptionist") return agent;
  }
  return agents[0] || null;
}

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: PHONE_E164 ? { e164: PHONE_E164 } : undefined,
    select: {
      id: true,
      workspaceId: true,
      e164: true,
      providerNumberId: true,
      metadata: true,
    },
  });
  if (!phone?.e164) {
    throw new Error(`Phone not found: ${PHONE_E164}`);
  }

  const workspaceId = WORKSPACE_ID || phone.workspaceId;
  let agentId = AGENT_ID;
  if (!agentId) {
    const agent = await resolveAgent(workspaceId, phone.id);
    if (!agent) throw new Error(`No voice agent on ${phone.e164} in ${workspaceId}`);
    agentId = agent.id;
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true, name: true, phoneNumberId: true, status: true },
  });
  if (!agent) throw new Error(`Agent ${agentId} not found in ${workspaceId}`);

  console.log("REPUBLISH_VOICE_V3_START", {
    workspaceId,
    agentId: agent.id,
    agentName: agent.name,
    e164: phone.e164,
    phoneNumberId: phone.id,
  });

  const { syncVoiceAgentPhoneAssignment } = await import("../src/lib/voice/agent-phone");
  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: { phoneNumberId: phone.id },
  });
  await syncVoiceAgentPhoneAssignment({
    workspaceId,
    agentId: agent.id,
    phoneNumberId: phone.id,
    exclusive: true,
    allowMctbTexmlVoiceAgentTakeover: true,
  });

  process.env.VOICE_RUNTIME_PROVIDER = process.env.VOICE_RUNTIME_PROVIDER || "telnyx";

  const built = await publishVoiceAgent(workspaceId, agent.id, "republish-voice-v3-receptionist");
  const runtimeCfg = await loadVoiceAgentRuntimeConfig(workspaceId, agent.id);
  if (!isAppointmentReceptionistAgent(runtimeCfg)) {
    console.warn("WARN_NOT_APPOINTMENT_RECEPTIONIST", {
      capabilityPack: (runtimeCfg?.advanced as Record<string, unknown>)?.capabilityPack,
    });
  }

  const route = await routePhoneToVoiceV3BasicCallControl({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
    workspaceId,
    phoneNumberId: phone.id,
  });

  console.log("REPUBLISH_VOICE_V3_DONE", {
    version: built.version.version,
    deploymentStatus: built.version.deploymentStatus,
    routeMatched: route.matched,
    connectionId: route.connectionId,
    path: route.path,
    outboundVoiceProfileId: route.outboundVoiceProfileId,
  });

  if (!route.matched) {
    throw new Error(`Telnyx connection_id mismatch after route: ${route.path}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
