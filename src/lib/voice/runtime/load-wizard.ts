import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadWizardFromAgent(
  workspaceId: string,
  agentId: string,
): Promise<AppointmentReceptionistWizardState | null> {
  const config = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  const advanced = asRecord(config.advanced);
  const wizard = advanced.appointmentReceptionistWizard;
  if (!wizard || typeof wizard !== "object") return null;
  return wizard as AppointmentReceptionistWizardState;
}
