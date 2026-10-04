import "server-only";

import { saveBusinessBrainPartial } from "@/lib/agents/appointment-booking/business-brain";
import { buildAiRecoverySavePatch } from "@/lib/mctb/ai-recovery/sync-collection-config";
import { normalizeSmsCollectFields } from "@/lib/mctb/ai-recovery/collect-field-schema";
import {
  deriveSimplifiedFieldEnabled,
  type AiRecoverySimplifiedField,
} from "@/lib/mctb/ai-recovery/simplified-fields";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { saveMctbHandoffConfig } from "@/lib/mctb/handoff/config";
import { applyLaunchAiRepliesSetting } from "@/lib/mctb/launch-lead-recovery";
import {
  loadLeadRecoveryConfig,
  saveLeadRecoveryConfig,
} from "@/lib/mctb/lead-recovery/config";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";
import { loadMctbLeadRecoveryKnowledgeBundle } from "@/lib/mctb/lead-recovery/knowledge-prompt";
import { normalizeCustomRecoveryGoal } from "@/lib/mctb/ai-recovery/recovery-goal";
import type {
  LeadRecoveryScenarioKey,
  MctbAiRecoveryGoalType,
  MctbSmsCollectFieldDef,
} from "@/lib/mctb/lead-recovery/types";

const MAX_ABOUT = 12_000;
const MAX_EMERGENCY = 4_000;

export type AiRecoverySaveBundleInput = {
  workspaceId: string;
  enabled: boolean;
  smsCollectFields?: MctbSmsCollectFieldDef[];
  allowDynamicCustomQuestions?: boolean;
  enabledScenarios?: Partial<Record<LeadRecoveryScenarioKey, boolean>>;
  bookingLinkEnabled?: boolean;
  bookingLinkId?: string | null;
  fieldToggles?: Record<AiRecoverySimplifiedField, boolean>;
  aboutBusiness?: string;
  emergencyCriteria?: string;
  emergencyDetectionEnabled?: boolean;
  recoveryGoalType?: MctbAiRecoveryGoalType;
  customRecoveryGoal?: string | null;
};

export type AiRecoverySaveBundleResult = {
  config: Awaited<ReturnType<typeof loadLeadRecoveryConfig>>;
  health: Awaited<ReturnType<typeof computeLeadRecoveryPolicyHealth>>;
  consentMode: Awaited<ReturnType<typeof loadMctbConsentMode>>;
  /** True when inbound SMS should use AI Recovery on the next reply (enabled + handoff mode). */
  runtimeArmed: boolean;
  runtimePromptBlock: string;
};

function parseFieldToggles(body: Record<string, unknown>): Record<AiRecoverySimplifiedField, boolean> {
  const fields = body.fields;
  const base = deriveSimplifiedFieldEnabled([]);
  if (!fields || typeof fields !== "object") return base;
  const f = fields as Record<string, unknown>;
  return {
    NAME: f.NAME === true,
    REASON: f.REASON === true,
    ADDRESS: f.ADDRESS === true,
    URGENCY: f.URGENCY === true,
    CALLBACK_TIME: f.CALLBACK_TIME === true,
  };
}

/**
 * Single publish path for the AI Recovery setup page.
 * Updates only Lead Recovery + business knowledge + handoff runtime mode.
 * Does not read or write consent mode, phone, forwarding, or other Setup sections.
 */
export async function saveAiRecoveryBundle(
  input: AiRecoverySaveBundleInput,
): Promise<AiRecoverySaveBundleResult> {
  const consentBefore = await loadMctbConsentMode(input.workspaceId);
  const existing = await loadLeadRecoveryConfig(input.workspaceId);

  const fieldToggles = input.fieldToggles ?? deriveSimplifiedFieldEnabled([]);
  const hasLegacyFieldPayload = input.fieldToggles != null;
  const persistFieldsDespiteStaleMasterFlag =
    !input.enabled && existing.enabled && hasLegacyFieldPayload;

  if (!input.enabled && !persistFieldsDespiteStaleMasterFlag) {
    if (input.aboutBusiness !== undefined) {
      const about = input.aboutBusiness.trim().slice(0, MAX_ABOUT) || null;
      await saveBusinessBrainPartial(input.workspaceId, { aboutBusiness: about });
    }
    if (
      input.emergencyCriteria !== undefined ||
      input.emergencyDetectionEnabled === true ||
      input.emergencyDetectionEnabled === false
    ) {
      const handoffPatch: Parameters<typeof saveMctbHandoffConfig>[1] = {};
      if (input.emergencyCriteria !== undefined) {
        const raw = input.emergencyCriteria.trim().slice(0, MAX_EMERGENCY);
        handoffPatch.emergencyCriteria = raw || null;
      }
      if (input.emergencyDetectionEnabled === true || input.emergencyDetectionEnabled === false) {
        handoffPatch.emergencyDetectionEnabled = input.emergencyDetectionEnabled;
      }
      await saveMctbHandoffConfig(input.workspaceId, handoffPatch).catch(() => undefined);
    }
    await applyLaunchAiRepliesSetting(input.workspaceId, false);
    const disabledConfig = await loadLeadRecoveryConfig(input.workspaceId);
    const health = await computeLeadRecoveryPolicyHealth(input.workspaceId, disabledConfig);
    const consentAfter = await loadMctbConsentMode(input.workspaceId);
    if (consentAfter !== consentBefore) {
      throw new Error("ai_recovery_save_mutated_consent_mode");
    }
    const bundle = await loadMctbLeadRecoveryKnowledgeBundle(input.workspaceId);
    return {
      config: disabledConfig,
      health,
      consentMode: consentAfter,
      runtimeArmed: false,
      runtimePromptBlock: bundle.runtime_prompt_block,
    };
  }

  const recoveryGoalType =
    input.recoveryGoalType ?? existing.recoveryGoalType ?? "FOLLOW_UP";
  const customRecoveryGoal =
    input.customRecoveryGoal !== undefined
      ? normalizeCustomRecoveryGoal(input.customRecoveryGoal)
      : existing.customRecoveryGoal ?? null;

  const patch = buildAiRecoverySavePatch({
    enabled: true,
    fieldToggles,
    smsCollectFields: input.smsCollectFields
      ? normalizeSmsCollectFields(input.smsCollectFields)
      : undefined,
    allowDynamicCustomQuestions: input.allowDynamicCustomQuestions,
    enabledScenarios: input.enabledScenarios,
    recoveryGoalType,
    customRecoveryGoal,
    bookingLinkEnabled: input.bookingLinkEnabled === true,
    bookingLinkId: input.bookingLinkId ?? existing.bookingLinkId,
    existing,
  });

  await saveLeadRecoveryConfig(input.workspaceId, patch);

  const handoffPatch: Parameters<typeof saveMctbHandoffConfig>[1] = {
    responseMode: "ai_conversation",
    bookingBehavior: "on_request",
  };
  if (input.emergencyCriteria !== undefined) {
    const raw = input.emergencyCriteria.trim().slice(0, MAX_EMERGENCY);
    handoffPatch.emergencyCriteria = raw || null;
  }
  if (input.emergencyDetectionEnabled === true || input.emergencyDetectionEnabled === false) {
    handoffPatch.emergencyDetectionEnabled = input.emergencyDetectionEnabled;
  }
  await saveMctbHandoffConfig(input.workspaceId, handoffPatch).catch(() => undefined);

  if (input.aboutBusiness !== undefined) {
    const about = input.aboutBusiness.trim().slice(0, MAX_ABOUT) || null;
    await saveBusinessBrainPartial(input.workspaceId, { aboutBusiness: about });
  }

  const finalConfig = await loadLeadRecoveryConfig(input.workspaceId);
  const health = await computeLeadRecoveryPolicyHealth(input.workspaceId, finalConfig);
  const consentAfter = await loadMctbConsentMode(input.workspaceId);
  if (consentAfter !== consentBefore) {
    throw new Error("ai_recovery_save_mutated_consent_mode");
  }

  const knowledge = await loadMctbLeadRecoveryKnowledgeBundle(input.workspaceId);
  const runtimeArmed =
    finalConfig.enabled &&
    finalConfig.policyHealth !== "DISABLED" &&
    knowledge.runtime_prompt_block.trim().length > 0;

  return {
    config: finalConfig,
    health,
    consentMode: consentAfter,
    runtimeArmed,
    runtimePromptBlock: knowledge.runtime_prompt_block,
  };
}

export function fieldTogglesFromBody(body: Record<string, unknown>): Record<AiRecoverySimplifiedField, boolean> {
  return parseFieldToggles(body);
}
