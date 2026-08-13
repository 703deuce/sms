import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
  type ReceptionistDraftInput,
} from "./compile";
import { getReceptionistCompiledFromAdvanced } from "./runtime";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";

/** Re-compile receptionist draft from wizard snapshot stored on advanced. */
export function recompileReceptionistFromDraft(config: VoiceAgentConfig): VoiceAgentConfig {
  const advanced = config.advanced as Record<string, unknown> | undefined;
  const wizard = advanced?.receptionistWizard as Partial<ReceptionistWizardState> | undefined;
  if (!wizard) {
    const existing = getReceptionistCompiledFromAdvanced(advanced);
    return existing ? config : config;
  }

  const draftInput: ReceptionistDraftInput = {
    agentName: wizard.agentName || config.identity?.displayName || "Amy",
    businessName: wizard.businessName || "",
    businessDescription: wizard.businessDescription || config.instructions?.system || "",
    greeting:
      wizard.greeting ||
      (config.callHandling as { startupGreeting?: { text?: string } } | undefined)?.startupGreeting
        ?.text ||
      "",
    language: wizard.language || config.voiceLanguage?.primaryLanguage || "en-US",
    timezone:
      (wizard as { timezone?: string }).timezone ||
      String(config.dynamicVariables?.business_timezone || "America/New_York"),
    answerTiming: wizard.answerTiming || "every_call",
    capabilities: wizard.capabilities || [],
    collectFields: wizard.collectFields || [],
    voiceId: wizard.voiceId || config.voiceLanguage?.voiceId || "ava-warm-us",
    voiceLabel: wizard.voiceLabel,
    advanced: {
      conversationBehavior: advanced?.conversationBehavior,
      bookingPolicy: advanced?.bookingPolicy,
      transferPolicy: advanced?.transferPolicy,
      knowledgePolicy: advanced?.knowledgePolicy,
      actionPermissions: advanced?.actionPermissions,
      fallbackPolicy: advanced?.fallbackPolicy,
      notifications: advanced?.notifications,
    },
  };

  const snapshot = compileReceptionistConfig(draftInput);
  return applyCompiledToVoiceConfig(config, snapshot);
}
