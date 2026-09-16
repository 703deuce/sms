import type { CompiledIntakeField, VoiceV2IntakeSchema } from "../intake/types";

/** Field descriptor sent to the post-call extraction LLM (pinned published schema). */
export type PostCallExtractionFieldDescriptor = {
  fieldKey: string;
  label: string;
  type: string;
  requirement: string;
  description?: string;
  questionText?: string;
  allowedValues?: string[];
};

/**
 * Dynamic extraction schema: exactly the enabled fields on the pinned intake schema
 * (no hardcoded built-in list). Disabled fields are omitted at compile time.
 */
export function buildDynamicExtractionSchema(
  pinnedSchema: VoiceV2IntakeSchema,
): PostCallExtractionFieldDescriptor[] {
  return pinnedSchema.fields.map((f) => fieldToDescriptor(f));
}

export function extractionSchemaFieldKeys(pinnedSchema: VoiceV2IntakeSchema): string[] {
  return pinnedSchema.fields.map((f) => f.key);
}

function fieldToDescriptor(f: CompiledIntakeField): PostCallExtractionFieldDescriptor {
  return {
    fieldKey: f.key,
    label: f.label,
    type: f.valueType,
    requirement: f.requirementLevel,
    description: f.questionText !== f.label ? f.questionText : undefined,
    questionText: f.questionText,
  };
}
