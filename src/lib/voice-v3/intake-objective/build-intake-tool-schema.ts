import { z } from "zod";
import type { VoiceV3AgentConfig } from "../config/agent-config";

const SEMANTIC_HINTS: Record<string, string> = {
  name: "Caller's full name as clearly provided or corrected.",
  email: "Caller's email address as clearly provided or corrected.",
  phone: "Caller's phone number when explicitly provided or corrected.",
  service_reason: "Reason the caller needs service or assistance.",
};

export function intakeFieldSchemaDescription(field: VoiceV3AgentConfig["intakeFields"][number]): string {
  const hint =
    field.description?.trim() ||
    SEMANTIC_HINTS[field.key] ||
    `${field.label} (${field.type})`;
  const enumNote =
    field.enumValues?.length
      ? ` Allowed values: ${field.enumValues.join(", ")}.`
      : "";
  return `${field.required ? "Configured intake" : "Optional intake"}: ${hint}${enumNote} Null if caller did not provide or correct this field in this turn.`;
}

function zodNullableFieldSchema(field: VoiceV3AgentConfig["intakeFields"][number]): z.ZodNullable<z.ZodType<string>> {
  const desc = intakeFieldSchemaDescription(field);
  if (field.enumValues && field.enumValues.length > 0) {
    return z.enum(field.enumValues as [string, ...string[]]).nullable().describe(desc);
  }
  return z.string().nullable().describe(desc);
}

export function buildUpdateIntakeZodSchema(config: VoiceV3AgentConfig) {
  const fieldShape: Record<string, z.ZodNullable<z.ZodType<string>>> = {};
  for (const f of config.intakeFields) {
    fieldShape[f.key] = zodNullableFieldSchema(f);
  }
  return z.object(fieldShape);
}

export function normalizeUpdateIntakeArguments(
  config: VoiceV3AgentConfig,
  raw: unknown,
): Record<string, unknown> {
  const row =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  for (const f of config.intakeFields) {
    if (!(f.key in row)) row[f.key] = null;
  }
  return row;
}
