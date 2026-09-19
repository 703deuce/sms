import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";

export type VoiceV3WizardResolutionSource = "wizard_published" | "wizard_draft_test";

function wizardFromConfig(config: VoiceAgentConfig): AppointmentReceptionistWizardState | null {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const w = advanced.appointmentReceptionistWizard;
  if (!w || typeof w !== "object") return null;
  return w as AppointmentReceptionistWizardState;
}

/**
 * Production ACTIVE agents use the published version snapshot.
 * TESTING agents use live draftConfig so Step 7 edits compile without another build.
 */
export function resolveWizardSnapshotForVoiceV3(input: {
  agentStatus: string;
  draftConfig: unknown;
  publishedRuntimeConfig: VoiceAgentConfig;
}): { wizard: AppointmentReceptionistWizardState | null; source: VoiceV3WizardResolutionSource } {
  if (input.agentStatus === "TESTING") {
    const draft = parseVoiceAgentConfig(input.draftConfig || {});
    const draftWizard = wizardFromConfig(draft);
    if (draftWizard) {
      return { wizard: draftWizard, source: "wizard_draft_test" };
    }
  }

  const publishedWizard = wizardFromConfig(input.publishedRuntimeConfig);
  return { wizard: publishedWizard, source: "wizard_published" };
}
