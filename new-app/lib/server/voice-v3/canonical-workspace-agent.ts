import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveInboundAiAgent } from "@/lib/voice/agent-phone";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isAppointmentReceptionistAgent } from "./config/from-published-agent";

export type CanonicalVoiceV3WorkspaceAgent = {
  agentId: string;
  agentName: string;
  status: string;
  published: boolean;
  /** Primary DID the cert agent is assigned to (e.g. +15717491060). */
  primaryPhoneNumberId: string | null;
  primaryPhoneE164: string | null;
};

function canonicalAgentIdFromEnv(): string | null {
  const id = process.env.VOICE_V3_CANONICAL_AGENT_ID?.trim();
  return id || null;
}

function canonicalCertE164FromEnv(): string {
  return process.env.VOICE_V3_CANONICAL_E164?.trim() || "+15717491060";
}

async function validateCanonicalCandidate(input: {
  workspaceId: string;
  agentId: string;
}): Promise<CanonicalVoiceV3WorkspaceAgent | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      name: true,
      displayName: true,
      status: true,
      publishedVersionId: true,
      phoneNumberId: true,
      draftConfig: true,
    },
  });
  if (!agent) return null;

  const config = parseVoiceAgentConfig(agent.draftConfig);
  if (!isAppointmentReceptionistAgent(config)) return null;

  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, agent.id);
  if (!isAppointmentReceptionistAgent(runtime)) return null;

  let primaryPhoneE164: string | null = null;
  if (agent.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId, workspaceId: input.workspaceId },
      select: { e164: true },
    });
    primaryPhoneE164 = pn?.e164 ?? null;
  }

  return {
    agentId: agent.id,
    agentName: agent.displayName || agent.name,
    status: agent.status,
    published: Boolean(agent.publishedVersionId),
    primaryPhoneNumberId: agent.phoneNumberId,
    primaryPhoneE164,
  };
}

/**
 * The one GPT-Live Voice V3 (appointment receptionist) agent for a workspace.
 * Used for Call Handling, PSTN v3-basic bind, and LiveKit DID routing — never "newest Danny".
 *
 * Resolution order:
 * 1. `VOICE_V3_CANONICAL_AGENT_ID` when set and valid for the workspace
 * 2. Inbound AI owner of `VOICE_V3_CANONICAL_E164` (default +15717491060)
 */
export async function resolveCanonicalVoiceV3WorkspaceAgent(
  workspaceId: string,
): Promise<CanonicalVoiceV3WorkspaceAgent | null> {
  const envId = canonicalAgentIdFromEnv();
  if (envId) {
    const fromEnv = await validateCanonicalCandidate({ workspaceId, agentId: envId });
    if (fromEnv) return fromEnv;
    console.error("VOICE_V3_CANONICAL_AGENT_ID_INVALID", {
      workspaceId,
      agentId: envId,
    });
  }

  const prisma = getPrisma();
  const certE164 = canonicalCertE164FromEnv();
  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: certE164 },
    select: { id: true, e164: true },
  });
  if (!phone) {
    console.warn("VOICE_V3_CANONICAL_CERT_PHONE_MISSING", { workspaceId, certE164 });
    return null;
  }

  const inbound = await resolveInboundAiAgent(workspaceId, phone.id);
  if (!inbound) {
    console.warn("VOICE_V3_CANONICAL_CERT_PHONE_NO_INBOUND_AGENT", {
      workspaceId,
      certE164,
      phoneNumberId: phone.id,
    });
    return null;
  }

  return validateCanonicalCandidate({ workspaceId, agentId: inbound.id });
}

/** When canonical is configured, never route to a different receptionist. */
export async function resolveCanonicalVoiceV3WorkspaceAgentOrThrow(
  workspaceId: string,
): Promise<CanonicalVoiceV3WorkspaceAgent> {
  const agent = await resolveCanonicalVoiceV3WorkspaceAgent(workspaceId);
  if (!agent) {
    throw new Error(
      "No canonical Voice V3 agent is configured for this workspace (set VOICE_V3_CANONICAL_AGENT_ID or assign the cert agent to the cert DID).",
    );
  }
  return agent;
}
