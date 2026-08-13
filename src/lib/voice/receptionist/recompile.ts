import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  RECEPTIONIST_ADVANCED_KEY,
  type ReceptionistAdvancedSettings,
} from "@/lib/receptionist-wizard/advanced-types";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
  type ReceptionistDraftInput,
} from "./compile";
import { getReceptionistCompiledFromAdvanced } from "./runtime";

/** Re-compile receptionist draft from wizard snapshot stored on advanced. */
export function recompileReceptionistFromDraft(config: VoiceAgentConfig): VoiceAgentConfig {
  const advanced = config.advanced as Record<string, unknown> | undefined;
  const wizard = advanced?.receptionistWizard as Partial<ReceptionistWizardState> | undefined;
  if (!wizard) {
    const existing = getReceptionistCompiledFromAdvanced(advanced);
    return existing ? config : config;
  }

  const storedAdvanced = advanced?.[RECEPTIONIST_ADVANCED_KEY] as
    | ReceptionistAdvancedSettings
    | undefined;

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
      conversationBehavior: storedAdvanced?.conversationBehavior ?? advanced?.conversationBehavior,
      bookingPolicy: storedAdvanced?.bookingPolicy ?? advanced?.bookingPolicy,
      transferPolicy: storedAdvanced?.transferPolicy ?? advanced?.transferPolicy,
      knowledgePolicy: storedAdvanced?.knowledgePolicy ?? advanced?.knowledgePolicy,
      actionPermissions: storedAdvanced?.actionPermissions ?? advanced?.actionPermissions,
      fallbackPolicy: storedAdvanced?.fallbackPolicy ?? advanced?.fallbackPolicy,
      notifications: storedAdvanced?.notifications ?? advanced?.notifications,
      [RECEPTIONIST_ADVANCED_KEY]: storedAdvanced ?? advanced?.[RECEPTIONIST_ADVANCED_KEY],
      receptionistWizard: wizard,
    },
  };

  const snapshot = compileReceptionistConfig(draftInput);
  const merged = applyCompiledToVoiceConfig(config, snapshot);

  return {
    ...merged,
    advanced: {
      ...(merged.advanced as object),
      [RECEPTIONIST_ADVANCED_KEY]: storedAdvanced ?? advanced?.[RECEPTIONIST_ADVANCED_KEY],
      receptionistWizard: wizard,
      conversationBehavior: storedAdvanced?.conversationBehavior ?? advanced?.conversationBehavior,
      bookingPolicy: storedAdvanced?.bookingPolicy ?? advanced?.bookingPolicy,
      transferPolicy: storedAdvanced?.transferPolicy ?? advanced?.transferPolicy,
      knowledgePolicy: storedAdvanced?.knowledgePolicy ?? advanced?.knowledgePolicy,
      actionPermissions: storedAdvanced?.actionPermissions ?? advanced?.actionPermissions,
      fallbackPolicy: storedAdvanced?.fallbackPolicy ?? advanced?.fallbackPolicy,
      notifications: storedAdvanced?.notifications ?? advanced?.notifications,
    },
  };
}
