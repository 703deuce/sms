import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { isAppointmentReceptionistAgent } from "./config/from-published-agent";
import { resolveCanonicalVoiceV3WorkspaceAgent } from "./canonical-workspace-agent";
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

async function resolveCanonicalPublishedReceptionistAgentId(
  workspaceId: string,
): Promise<string | null> {
  const canonical = await resolveCanonicalVoiceV3WorkspaceAgent(workspaceId);
  if (!canonical?.published || canonical.status !== "ACTIVE") return null;
  const valid = await isValidPublishedAppointmentReceptionist({
    workspaceId,
    agentId: canonical.agentId,
  });
  return valid ? canonical.agentId : null;
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

  const canonicalAgentId = await resolveCanonicalPublishedReceptionistAgentId(
    phone.workspaceId,
  );
  if (!canonicalAgentId) return;

  const explicitDecision = decideExplicitCallHandlingPstnBind(phone.settingsJson);
  if (explicitDecision.useExplicit && explicitDecision.agentId !== canonicalAgentId) {
    console.warn("VOICE_V3_PSTN_EXPLICIT_AGENT_CANONICAL_OVERRIDE", {
      callControlId,
      toE164,
      workspaceId: phone.workspaceId,
      parkedAgentId: explicitDecision.agentId,
      canonicalAgentId,
    });
  }

  bindPstnWizardContext({
    callControlId,
    toE164,
    workspaceId: phone.workspaceId,
    agentId: canonicalAgentId,
    fromE164: input.fromE164,
    bindSource: explicitDecision.useExplicit
      ? "explicit_call_handling"
      : "canonical_workspace_agent",
  });
}
