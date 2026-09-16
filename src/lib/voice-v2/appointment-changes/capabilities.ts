import "server-only";

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { ReceptionistAdvancedSettings } from "@/lib/receptionist-wizard/advanced-types";
import { RECEPTIONIST_ADVANCED_KEY } from "@/lib/receptionist-wizard/advanced-types";

export async function voiceV2AppointmentChangeCapabilities(input: {
  workspaceId: string;
  agentId: string;
}): Promise<{ reschedule: boolean; cancel: boolean }> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true },
  });
  if (!agent) return { reschedule: false, cancel: false };
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const advanced = config.advanced as Record<string, unknown> | undefined;
  const wizard = advanced?.appointmentReceptionistWizard as { capabilities?: string[] } | undefined;
  const caps = new Set(wizard?.capabilities || []);
  const receptionist = advanced?.[RECEPTIONIST_ADVANCED_KEY] as ReceptionistAdvancedSettings | undefined;
  const perms = receptionist?.actionPermissions;
  return {
    reschedule: caps.has("reschedule") && (perms?.rescheduleAppointments ?? caps.has("reschedule")),
    cancel: caps.has("cancel") && (perms?.cancelAppointments ?? caps.has("cancel")),
  };
}
