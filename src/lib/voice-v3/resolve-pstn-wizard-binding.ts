import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { isAppointmentReceptionistAgent } from "./config/from-published-agent";
import { decideExplicitCallHandlingPstnBind } from "./pstn-wizard-agent-selection";
import { notePstnLegWizardContext } from "./telemetry/call-trace";

async function isValidPublishedAppointmentReceptionist(input: {
  workspaceId: string;
  agentId: string;
}): Promise<boolean> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { id: true, status: true, publishedVersionId: true },
  });
  if (!agent?.publishedVersionId) return false;
  if (agent.status !== "ACTIVE") return false;
  const cfg = await loadVoiceAgentRuntimeConfig(input.workspaceId, agent.id);
  return isAppointmentReceptionistAgent(cfg);
}

async function resolveLegacyPublishedReceptionistAgentId(workspaceId: string): Promise<string | null> {
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: {
      workspaceId,
      publishedVersionId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true },
  });

  for (const row of agents) {
    const cfg = await loadVoiceAgentRuntimeConfig(workspaceId, row.id);
    if (isAppointmentReceptionistAgent(cfg)) return row.id;
  }
  return null;
}

function bindPstnWizardContext(input: {
  callControlId: string;
  toE164: string;
  workspaceId: string;
  agentId: string;
  fromE164?: string | null;
  bindSource: "explicit_call_handling" | "legacy_recency";
}): void {
  notePstnLegWizardContext({
    callControlId: input.callControlId,
    callId: input.callControlId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    fromE164: input.fromE164,
  });
  console.log("VOICE_V3_PSTN_WIZARD_BOUND_FROM_E164", {
    callControlId: input.callControlId,
    toE164: input.toE164,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    bindSource: input.bindSource,
    fromE164: input.fromE164?.trim() || null,
  });
}

/**
 * When PSTN uses the isolated v3-basic Telnyx webhook (no VoiceCall row yet),
 * bind the next Live accept to the workspace's published appointment receptionist.
 */
export async function tryNotePstnWizardBindingFromToE164(input: {
  callControlId: string;
  toE164?: string | null;
  fromE164?: string | null;
}): Promise<void> {
  const callControlId = input.callControlId.trim();
  const toE164 = input.toE164?.trim();
  if (!callControlId || !toE164) return;

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: toE164 },
    select: { workspaceId: true, settingsJson: true },
  });
  if (!phone?.workspaceId) return;

  const explicitDecision = decideExplicitCallHandlingPstnBind(phone.settingsJson);
  if (explicitDecision.useExplicit) {
    const valid = await isValidPublishedAppointmentReceptionist({
      workspaceId: phone.workspaceId,
      agentId: explicitDecision.agentId,
    });
    if (valid) {
      bindPstnWizardContext({
        callControlId,
        toE164,
        workspaceId: phone.workspaceId,
        agentId: explicitDecision.agentId,
        fromE164: input.fromE164,
        bindSource: "explicit_call_handling",
      });
      return;
    }
    console.error("VOICE_V3_PSTN_EXPLICIT_CALL_HANDLING_AGENT_INVALID", {
      callControlId,
      toE164,
      workspaceId: phone.workspaceId,
      agentId: explicitDecision.agentId,
    });
    return;
  }

  const legacyAgentId = await resolveLegacyPublishedReceptionistAgentId(phone.workspaceId);
  if (!legacyAgentId) return;

  bindPstnWizardContext({
    callControlId,
    toE164,
    workspaceId: phone.workspaceId,
    agentId: legacyAgentId,
    fromE164: input.fromE164,
    bindSource: "legacy_recency",
  });
}
