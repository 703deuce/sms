import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { isAppointmentReceptionistAgent } from "./config/from-published-agent";
import { notePstnLegWizardContext } from "./telemetry/call-trace";

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
    select: { workspaceId: true },
  });
  if (!phone?.workspaceId) return;

  const agents = await prisma.voiceAgent.findMany({
    where: {
      workspaceId: phone.workspaceId,
      publishedVersionId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true },
  });

  for (const row of agents) {
    const cfg = await loadVoiceAgentRuntimeConfig(phone.workspaceId, row.id);
    if (!isAppointmentReceptionistAgent(cfg)) continue;

    notePstnLegWizardContext({
      callControlId,
      callId: callControlId,
      workspaceId: phone.workspaceId,
      agentId: row.id,
      fromE164: input.fromE164,
    });
    console.log("VOICE_V3_PSTN_WIZARD_BOUND_FROM_E164", {
      callControlId,
      toE164,
      workspaceId: phone.workspaceId,
      agentId: row.id,
      fromE164: input.fromE164?.trim() || null,
    });
    return;
  }
}
