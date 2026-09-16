import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { CallerFieldRow } from "@/lib/receptionist-wizard/advanced-types";
import { INTAKE_FIELD_DEFAULTS } from "./defaults";
import {
  BUILTIN_INTAKE_FIELD_KEYS,
  INTAKE_FIELD_KEYS,
  type BuiltinIntakeFieldKey,
  type CompiledIntakeField,
  type IntakeFieldKey,
  type IntakeFieldValueType,
  type IntakeRequirementLevel,
  type VoiceV2IntakeSchema,
  type VoiceV2IntakeWizardConfig,
} from "./types";

const BUILTIN_VALUE_TYPE: Record<BuiltinIntakeFieldKey, IntakeFieldValueType> = {
  name: "text",
  email: "email",
  phone: "phone",
  address: "address",
  service_reason: "text",
};

const CALLER_ID_TO_INTAKE_KEY: Record<string, BuiltinIntakeFieldKey> = {
  reason: "service_reason",
};

function asWizardConfig(config: VoiceAgentConfig | null | undefined): VoiceV2IntakeWizardConfig | null {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const raw = advanced.voiceV2Intake;
  if (!raw || typeof raw !== "object") return null;
  return raw as VoiceV2IntakeWizardConfig;
}

function readCallerFields(config: VoiceAgentConfig | null | undefined): CallerFieldRow[] {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const receptionist = advanced.receptionistAdvanced as { callerFields?: CallerFieldRow[] } | undefined;
  const rows = receptionist?.callerFields;
  return Array.isArray(rows) ? rows : [];
}

export function callerFieldIdToIntakeKey(id: string): string {
  let trimmed = id.trim();
  if (trimmed === "full_name") trimmed = "name";
  if (trimmed.startsWith("custom_")) trimmed = trimmed.slice("custom_".length);
  return CALLER_ID_TO_INTAKE_KEY[trimmed] ?? trimmed;
}

export function isBuiltinIntakeKey(key: string): boolean {
  return BUILTIN_INTAKE_FIELD_KEYS.includes(key as BuiltinIntakeFieldKey);
}

function callerRowValueType(row: CallerFieldRow): IntakeFieldValueType {
  const mapped = callerFieldIdToIntakeKey(row.id);
  if (isBuiltinIntakeKey(mapped)) {
    return BUILTIN_VALUE_TYPE[mapped as BuiltinIntakeFieldKey];
  }
  if (row.id === "email" || mapped === "email") return "email";
  if (row.id === "phone" || mapped === "phone") return "phone";
  if (row.id === "address" || mapped === "address") return "address";
  return "text";
}

function requirementFromCallerRow(row: CallerFieldRow): IntakeRequirementLevel {
  if (!row.required) return "OPTIONAL";
  if (row.askWhen === "when_booking") return "REQUIRED_BEFORE_BOOKING";
  return "REQUIRED_FOR_RECORD";
}

function resolveBuiltinField(
  key: BuiltinIntakeFieldKey,
  wizard: VoiceV2IntakeWizardConfig | null,
): CompiledIntakeField | null {
  const def = INTAKE_FIELD_DEFAULTS[key];
  const row = wizard?.fields?.[key];
  const enabled = row?.enabled ?? def.enabled;
  if (!enabled) return null;

  let requirementLevel = row?.requirementLevel ?? def.requirementLevel;
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
    valueType: BUILTIN_VALUE_TYPE[key],
  };
}

function resolveCustomCallerField(row: CallerFieldRow): CompiledIntakeField | null {
  if (!row.enabled) return null;
  const key = callerFieldIdToIntakeKey(row.id);
  if (isBuiltinIntakeKey(key)) return null;

  const label = row.label?.trim() || key;
  const questionText =
    row.question?.trim() || `May I have your ${label.toLowerCase()}?`;

  return {
    key,
    enabled: true,
    requirementLevel: requirementFromCallerRow(row),
    label,
    questionText,
    valueType: callerRowValueType(row),
  };
}

export function compileIntakeSchemaParts(input: {
  voiceV2Intake?: VoiceV2IntakeWizardConfig | null;
  callerFields?: CallerFieldRow[];
}): VoiceV2IntakeSchema {
  const wizard = input.voiceV2Intake ?? null;
  const fields: CompiledIntakeField[] = [];
  const seen = new Set<string>();

  for (const key of BUILTIN_INTAKE_FIELD_KEYS) {
    const compiled = resolveBuiltinField(key, wizard);
    if (compiled) {
      fields.push(compiled);
      seen.add(key);
    }
  }

  for (const row of input.callerFields ?? []) {
    const intakeKey = callerFieldIdToIntakeKey(row.id);
    if (isBuiltinIntakeKey(intakeKey)) continue;
    if (seen.has(intakeKey)) continue;
    const compiled = resolveCustomCallerField(row);
    if (!compiled) continue;
    fields.push(compiled);
    seen.add(compiled.key);
  }

  return { fields };
}

/** PRELOAD_ONCE_PER_CALL — compile from published/draft agent config. */
export function compileVoiceV2IntakeSchema(
  config: VoiceAgentConfig | null | undefined,
): VoiceV2IntakeSchema {
  return compileIntakeSchemaParts({
    voiceV2Intake: asWizardConfig(config),
    callerFields: readCallerFields(config),
  });
}

export function intakeSchemaFromWizardOnly(
  wizard: VoiceV2IntakeWizardConfig,
  callerFields?: CallerFieldRow[],
): VoiceV2IntakeSchema {
  return compileIntakeSchemaParts({ voiceV2Intake: wizard, callerFields });
}
