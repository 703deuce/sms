import type { VoiceAgentConfig } from "@/lib/voice/types";
import { getReceptionistCompiledFromAdvanced } from "@/lib/voice/receptionist/runtime";
import {
  RECEPTIONIST_ADVANCED_KEY,
  type ReceptionistAdvancedSettings,
} from "./advanced-types";
import {
  actionPermissionsFromCapabilities,
  createDefaultAdvancedSettings,
} from "./advanced-defaults";
import type { CapabilityId } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeAdvanced(
  base: ReceptionistAdvancedSettings,
  patch: Partial<ReceptionistAdvancedSettings>,
): ReceptionistAdvancedSettings {
  return {
    ...base,
    ...patch,
    conversationBehavior: { ...base.conversationBehavior, ...patch.conversationBehavior },
    bookingPolicy: { ...base.bookingPolicy, ...patch.bookingPolicy },
    transferPolicy: { ...base.transferPolicy, ...patch.transferPolicy },
    knowledgePolicy: { ...base.knowledgePolicy, ...patch.knowledgePolicy },
    actionPermissions: { ...base.actionPermissions, ...patch.actionPermissions },
    fallbackPolicy: { ...base.fallbackPolicy, ...patch.fallbackPolicy },
    notifications: { ...base.notifications, ...patch.notifications },
    callerFields: patch.callerFields ?? base.callerFields,
    intents: patch.intents ?? base.intents,
    decisionRules: patch.decisionRules ?? base.decisionRules,
  };
}

function advancedFromCompiledSnapshot(
  compiled: NonNullable<ReturnType<typeof getReceptionistCompiledFromAdvanced>>,
): Partial<ReceptionistAdvancedSettings> {
  return {
    conversationBehavior: compiled.conversationBehavior as ReceptionistAdvancedSettings["conversationBehavior"],
    bookingPolicy: compiled.bookingPolicy as ReceptionistAdvancedSettings["bookingPolicy"],
    transferPolicy: compiled.transferPolicy as ReceptionistAdvancedSettings["transferPolicy"],
    knowledgePolicy: compiled.knowledgePolicy as ReceptionistAdvancedSettings["knowledgePolicy"],
    actionPermissions: compiled.actionPermissions as ReceptionistAdvancedSettings["actionPermissions"],
    fallbackPolicy: compiled.fallbackPolicy as ReceptionistAdvancedSettings["fallbackPolicy"],
    notifications: compiled.notifications as ReceptionistAdvancedSettings["notifications"],
    intents: compiled.intentRules as ReceptionistAdvancedSettings["intents"],
    decisionRules: compiled.decisionRules as ReceptionistAdvancedSettings["decisionRules"],
  };
}

export function advancedFromDraftConfig(
  draftConfig: unknown,
  capabilities: CapabilityId[] = [],
): ReceptionistAdvancedSettings {
  const base = createDefaultAdvancedSettings();
  const cfg = draftConfig as VoiceAgentConfig | null | undefined;
  const advanced = asRecord(cfg?.advanced);

  const stored = advanced[RECEPTIONIST_ADVANCED_KEY] as Partial<ReceptionistAdvancedSettings> | undefined;
  if (stored) {
    const merged = mergeAdvanced(base, stored);
    if (capabilities.length) {
      merged.actionPermissions = actionPermissionsFromCapabilities(
        capabilities,
        merged.actionPermissions,
      );
    }
    return merged;
  }

  const compiled = getReceptionistCompiledFromAdvanced(advanced);
  if (compiled) {
    const fromCompiled = advancedFromCompiledSnapshot(compiled);
    const merged = mergeAdvanced(base, fromCompiled);
    if (capabilities.length) {
      merged.actionPermissions = actionPermissionsFromCapabilities(
        capabilities,
        merged.actionPermissions,
      );
    }
    return merged;
  }

  if (capabilities.length) {
    base.actionPermissions = actionPermissionsFromCapabilities(capabilities, base.actionPermissions);
  }
  return base;
}
