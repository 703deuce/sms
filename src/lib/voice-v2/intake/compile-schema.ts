import type { VoiceAgentConfig } from "@/lib/voice/types";
import { INTAKE_FIELD_DEFAULTS } from "./defaults";
import {
  INTAKE_FIELD_KEYS,
  type CompiledIntakeField,
  type IntakeFieldKey,
  type IntakeRequirementLevel,
  type VoiceV2IntakeSchema,
  type VoiceV2IntakeWizardConfig,
} from "./types";

function asWizardConfig(config: VoiceAgentConfig | null | undefined): VoiceV2IntakeWizardConfig | null {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const raw = advanced.voiceV2Intake;
  if (!raw || typeof raw !== "object") return null;
  return raw as VoiceV2IntakeWizardConfig;
}

function resolveField(
  key: IntakeFieldKey,
  wizard: VoiceV2IntakeWizardConfig | null,
): CompiledIntakeField | null {
  const def = INTAKE_FIELD_DEFAULTS[key];
  const row = wizard?.fields?.[key];
  const enabled = row?.enabled ?? def.enabled;
  if (!enabled) return null;

  let requirementLevel = row?.requirementLevel ?? def.requirementLevel;
  if (!enabled && requirementLevel !== "OPTIONAL") {
    requirementLevel = "OPTIONAL";
  }
  if (
    requirementLevel !== "OPTIONAL" &&
    requirementLevel !== "REQUIRED_FOR_RECORD" &&
    requirementLevel !== "REQUIRED_BEFORE_BOOKING"
  ) {
    requirementLevel = def.requirementLevel;
  }

  const label = (row?.label || def.label).trim() || def.label;
  const questionText = (row?.questionText || def.questionText).trim() || def.questionText;

  return {
    key,
    enabled: true,
    requirementLevel,
    label,
    questionText,
  };
}

/** PRELOAD_ONCE_PER_CALL — compile from published/draft agent config. */
export function compileVoiceV2IntakeSchema(
  config: VoiceAgentConfig | null | undefined,
): VoiceV2IntakeSchema {
  const wizard = asWizardConfig(config);
  const fields: CompiledIntakeField[] = [];
  for (const key of INTAKE_FIELD_KEYS) {
    const compiled = resolveField(key, wizard);
    if (compiled) fields.push(compiled);
  }
  return { fields };
}

export function intakeSchemaFromWizardOnly(
  wizard: VoiceV2IntakeWizardConfig,
): VoiceV2IntakeSchema {
  const fields: CompiledIntakeField[] = [];
  for (const key of INTAKE_FIELD_KEYS) {
    const compiled = resolveField(key, wizard);
    if (compiled) fields.push(compiled);
  }
  return { fields };
}
