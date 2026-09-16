import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { callerFieldIdToIntakeKey } from "./intake/compile-schema";
import type {
  VoiceV2PublishedQualificationConfig,
  VoiceV2QualificationRuleRow,
} from "./qualification-types";
const ADV_KEY = "qualification";

function collectFieldIdToIntakeKey(id: string): string {
  let trimmed = id.trim();
  if (trimmed === "full_name") trimmed = "name";
  if (trimmed === "service") trimmed = "reason";
  return callerFieldIdToIntakeKey(trimmed);
}

function asQualRecord(advanced?: Record<string, unknown> | null): Record<string, unknown> {
  const raw = advanced?.[ADV_KEY];
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function qualificationFieldKeysFromWizard(
  state: AppointmentReceptionistWizardState,
): string[] {
  const keys = new Set<string>();
  for (const f of state.collectFields || []) {
    if (f.useForQualification !== true || f.enabled === false) continue;
    keys.add(collectFieldIdToIntakeKey(f.id));
  }
  return [...keys];
}

export function qualificationConfigFromWizard(
  state: AppointmentReceptionistWizardState,
): VoiceV2PublishedQualificationConfig {
  const enabled =
    state.qualificationEnabled === true ||
    (state.qualificationEnabled !== false &&
      state.capabilities?.includes("qualify_callers") === true);
  const rules = (state.qualificationRules || []).filter((r) => r.fieldKey?.trim());
  const supportedZipCodes = (state.qualificationSupportedZipCodes || [])
    .map((z) => z.trim())
    .filter(Boolean);
  const revision =
    state.qualificationRevision?.trim() ||
    `qual:v${enabled ? 1 : 0}:${rules.length}:${supportedZipCodes.join(",")}`;

  return {
    qualificationEnabled: enabled,
    qualificationRequiredBeforePrimaryAction:
      state.qualificationRequiredBeforePrimaryAction === true,
    qualificationRevision: revision,
    rules,
    rulesMatchMode: state.qualificationRulesMatchMode === "ANY" ? "ANY" : "ALL",
    supportedZipCodes,
    notQualifiedFallback: state.qualificationNotQualifiedFallback || "TAKE_MESSAGE",
    needsReviewFallback: state.qualificationNeedsReviewFallback || "TAKE_MESSAGE",
    qualificationFieldKeys: qualificationFieldKeysFromWizard(state),
  };
}

export function resolveVoiceV2QualificationConfig(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): VoiceV2PublishedQualificationConfig {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const pinned = asQualRecord(advanced);
  const wizard = advanced.appointmentReceptionistWizard as
    | AppointmentReceptionistWizardState
    | undefined;

  if (pinned.qualificationEnabled !== undefined || pinned.qualificationRevision) {
    return {
      qualificationEnabled: Boolean(pinned.qualificationEnabled),
      qualificationRequiredBeforePrimaryAction: Boolean(
        pinned.qualificationRequiredBeforePrimaryAction,
      ),
      qualificationRevision: String(pinned.qualificationRevision || "unknown"),
      rules: Array.isArray(pinned.rules)
        ? (pinned.rules as VoiceV2QualificationRuleRow[])
        : [],
      rulesMatchMode: pinned.rulesMatchMode === "ANY" ? "ANY" : "ALL",
      supportedZipCodes: Array.isArray(pinned.supportedZipCodes)
        ? pinned.supportedZipCodes.map(String)
        : [],
      notQualifiedFallback:
        (pinned.notQualifiedFallback as VoiceV2PublishedQualificationConfig["notQualifiedFallback"]) ||
        "TAKE_MESSAGE",
      needsReviewFallback:
        (pinned.needsReviewFallback as VoiceV2PublishedQualificationConfig["needsReviewFallback"]) ||
        "TAKE_MESSAGE",
      qualificationFieldKeys: Array.isArray(pinned.qualificationFieldKeys)
        ? pinned.qualificationFieldKeys.map(String)
        : [],
    };
  }
  if (wizard) return qualificationConfigFromWizard(wizard);
  return {
    qualificationEnabled: false,
    qualificationRequiredBeforePrimaryAction: false,
    qualificationRevision: "none",
    rules: [],
    rulesMatchMode: "ALL",
    supportedZipCodes: [],
    notQualifiedFallback: "TAKE_MESSAGE",
    needsReviewFallback: "TAKE_MESSAGE",
    qualificationFieldKeys: [],
  };
}

export function isVoiceV2QualificationEnabled(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  return resolveVoiceV2QualificationConfig(config).qualificationEnabled;
}

export function buildVoiceV2QualificationLayerBInstructions(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): string | null {
  const q = resolveVoiceV2QualificationConfig(config);
  if (!q.qualificationEnabled) return null;
  const fields =
    q.qualificationFieldKeys.length > 0
      ? q.qualificationFieldKeys.join(", ")
      : "configured qualification fields";
  return [
    "Lead qualification is enabled for this business.",
    `Configured qualification fields: ${fields}. Ask only for values still missing — never re-ask known fields.`,
    "Use natural conversation; do not run through a rigid questionnaire.",
    "Do not tell the caller internal qualification status, scores, or rule names.",
    "If the caller is outside the service area or not a fit, explain naturally and follow the configured fallback (message or request).",
    "After qualification topics, continue the same conversation and booking or message flow without resetting known caller details.",
  ].join(" ");
}
