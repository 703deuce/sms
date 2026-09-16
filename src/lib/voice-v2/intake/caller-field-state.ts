import type {
  CompiledIntakeField,
  IntakeFieldKey,
  IntakeFieldValue,
  VoiceV2CallContext,
  VoiceV2IntakeSchema,
  VoiceV2IntakeState,
} from "./types";

export type VoiceV2CallerFieldDisposition = "KNOWN" | "MISSING" | "DISABLED";

export type VoiceV2CallerFieldState = {
  key: IntakeFieldKey;
  disposition: VoiceV2CallerFieldDisposition;
  value?: string;
  source?: IntakeFieldValue["source"];
  status?: IntakeFieldValue["status"];
  requirementLevel?: CompiledIntakeField["requirementLevel"];
};

function fieldRow(
  schema: VoiceV2IntakeSchema,
  key: IntakeFieldKey,
): CompiledIntakeField | undefined {
  return schema.fields.find((f) => f.key === key);
}

export function isCallerFieldValueKnown(field?: IntakeFieldValue): boolean {
  if (!field?.value?.trim()) return false;
  if (field.status === "MISSING") return false;
  return true;
}

/** Generic authority: one read layer over pinned schema + CallContext intake state. */
export function resolveVoiceV2CallerFieldState(input: {
  intakeSchema: VoiceV2IntakeSchema;
  intakeState: VoiceV2IntakeState;
  fieldKey: IntakeFieldKey;
}): VoiceV2CallerFieldState {
  const compiled = fieldRow(input.intakeSchema, input.fieldKey);
  if (!compiled) {
    return { key: input.fieldKey, disposition: "DISABLED" };
  }
  const row = input.intakeState[input.fieldKey];
  if (isCallerFieldValueKnown(row)) {
    return {
      key: input.fieldKey,
      disposition: "KNOWN",
      value: row!.value.trim(),
      source: row!.source,
      status: row!.status,
      requirementLevel: compiled.requirementLevel,
    };
  }
  return {
    key: input.fieldKey,
    disposition: "MISSING",
    requirementLevel: compiled.requirementLevel,
  };
}

export function resolveVoiceV2KnownCallerState(ctx: VoiceV2CallContext): {
  known: IntakeFieldKey[];
  missingBeforeBooking: IntakeFieldKey[];
  missingForRecord: IntakeFieldKey[];
  disabled: IntakeFieldKey[];
} {
  const known: IntakeFieldKey[] = [];
  const missingBeforeBooking: IntakeFieldKey[] = [];
  const missingForRecord: IntakeFieldKey[] = [];
  const disabled: IntakeFieldKey[] = [];

  const enabledKeys = new Set(ctx.intakeSchema.fields.map((f) => f.key));
  for (const key of Object.keys(ctx.intakeState) as IntakeFieldKey[]) {
    if (!enabledKeys.has(key) && isCallerFieldValueKnown(ctx.intakeState[key])) {
      known.push(key);
    }
  }

  for (const field of ctx.intakeSchema.fields) {
    const state = resolveVoiceV2CallerFieldState({
      intakeSchema: ctx.intakeSchema,
      intakeState: ctx.intakeState,
      fieldKey: field.key,
    });
    if (state.disposition === "KNOWN") {
      known.push(field.key);
      continue;
    }
    if (state.disposition === "DISABLED") {
      disabled.push(field.key);
      continue;
    }
    if (field.requirementLevel === "REQUIRED_BEFORE_BOOKING") {
      missingBeforeBooking.push(field.key);
    } else if (field.requirementLevel === "REQUIRED_FOR_RECORD") {
      missingForRecord.push(field.key);
    }
  }

  return { known, missingBeforeBooking, missingForRecord, disabled };
}

export function listKnownCallerFieldValues(
  ctx: VoiceV2CallContext,
): Partial<Record<IntakeFieldKey, string>> {
  const out: Partial<Record<IntakeFieldKey, string>> = {};
  for (const field of ctx.intakeSchema.fields) {
    const state = resolveVoiceV2CallerFieldState({
      intakeSchema: ctx.intakeSchema,
      intakeState: ctx.intakeState,
      fieldKey: field.key,
    });
    if (state.disposition === "KNOWN" && state.value) {
      out[field.key] = state.value;
    }
  }
  return out;
}
