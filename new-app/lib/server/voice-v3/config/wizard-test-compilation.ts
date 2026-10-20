import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { compileVoiceV3AgentConfig } from "./compile-voice-v3-agent-config";

export type VoiceV3WizardTestCompilationProbe = {
  source: "wizard_draft_test";
  configVersion: string;
  agentName: string;
  bookingStrategy: string;
  intakeFieldKeys: string[];
};

function wizardFromVoiceAgentConfig(
  config: VoiceAgentConfig,
): AppointmentReceptionistWizardState | null {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const w = advanced.appointmentReceptionistWizard;
  if (!w || typeof w !== "object") return null;
  return w as AppointmentReceptionistWizardState;
}

export function isAppointmentReceptionistVoiceAgent(config: VoiceAgentConfig): boolean {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

/**
 * Wizard Test step uses the same V3 compiler as production PSTN accept (draft snapshot).
 */
export function attachVoiceV3WizardTestCompilation(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  if (!isAppointmentReceptionistVoiceAgent(config)) return config;
  const wizard = wizardFromVoiceAgentConfig(config);
  if (!wizard) return config;

  const compiled = compileVoiceV3AgentConfig({
    wizard,
    source: "wizard_draft_test",
  });

  const probe: VoiceV3WizardTestCompilationProbe = {
    source: "wizard_draft_test",
    configVersion: compiled.configVersion ?? "",
    agentName: compiled.identity.agentName,
    bookingStrategy: compiled.scheduling.bookingStrategy,
    intakeFieldKeys: compiled.intakeFields.map((f) => f.key),
  };

  const advanced = { ...(config.advanced as object) } as Record<string, unknown>;
  advanced.voiceV3WizardTestCompilation = probe;

  return { ...config, advanced };
}
