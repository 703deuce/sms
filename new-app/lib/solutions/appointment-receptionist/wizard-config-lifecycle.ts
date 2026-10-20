import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "./types";
import { buildWizardAgentConfig } from "./build-agent-config";
import { sanitizeLiveKitTemplateOnAdvanced } from "@/lib/voice/templates/agent-template-config";

/** Authoritative editable wizard JSON lives under VoiceAgent.draftConfig.advanced. */
export const WIZARD_SNAPSHOT_KEY = "appointmentReceptionistWizard";
export const WIZARD_CONFIG_REVISION_KEY = "wizardConfigRevision";

export function readWizardConfigRevision(config: VoiceAgentConfig): number {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const raw = advanced[WIZARD_CONFIG_REVISION_KEY];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/**
 * Persist-only path: store wizard snapshot + revision without recompiling runtime config.
 * Published / live callers are unchanged until activate/publish compiles and syncs.
 */
export function patchAuthoritativeWizardOntoDraftConfig(
  prev: VoiceAgentConfig,
  state: AppointmentReceptionistWizardState,
  revision: number,
): VoiceAgentConfig {
  const prevAdvanced = sanitizeLiveKitTemplateOnAdvanced(
    (prev.advanced || {}) as Record<string, unknown>,
  );
  return {
    ...prev,
    advanced: {
      ...prevAdvanced,
      capabilityPack: prevAdvanced.capabilityPack ?? "appointment_receptionist",
      [WIZARD_SNAPSHOT_KEY]: { ...state },
      [WIZARD_CONFIG_REVISION_KEY]: revision,
    },
  };
}

export function nextWizardConfigRevision(prev: VoiceAgentConfig): number {
  return readWizardConfigRevision(prev) + 1;
}

/** Full compile — Test (via V3 compiler) and Activate / publish only. */
export function compileWizardStateToVoiceAgentConfig(
  state: AppointmentReceptionistWizardState,
): VoiceAgentConfig {
  return buildWizardAgentConfig(state);
}
