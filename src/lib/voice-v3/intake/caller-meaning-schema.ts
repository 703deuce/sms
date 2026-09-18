import { z } from "zod";
import type { VoiceV3AgentConfig } from "../config/agent-config";

const voiceV3GoalSchema = z.enum([
  "UNKNOWN",
  "GENERAL",
  "BOOK_APPOINTMENT",
  "REQUEST_CALLBACK",
  "REQUEST_TRANSFER",
]);

export const CALLER_MEANING_STRUCTURED_OUTPUT_NAME = "voice_v3_caller_meaning";

function intakeFieldKeySchema(config: VoiceV3AgentConfig) {
  const keys = config.intakeFields.map((f) => f.key).filter(Boolean);
  if (keys.length === 0) {
    return z.never();
  }
  return z.enum(keys as [string, ...string[]]);
}

/**
 * Per-agent Structured Output schema — captured_fields[].key and corrections[].key
 * are enums of configured intake keys only.
 */
export function buildCallerMeaningZodSchema(config: VoiceV3AgentConfig) {
  const fieldKey = intakeFieldKeySchema(config);

  return z.object({
    active_goal: voiceV3GoalSchema,
    captured_fields: z.array(
      z.object({
        key: fieldKey,
        value: z.string(),
        confidence: z.number(),
      }),
    ),
    scheduling: z.object({
      requested_date_expression: z.string().nullable(),
      requested_time_expression: z.string().nullable(),
      requested_daypart: z.string().nullable(),
    }),
    corrections: z.array(
      z.object({
        key: fieldKey,
        new_value: z.string(),
        confidence: z.number(),
      }),
    ),
    ambiguities: z.array(
      z.object({
        field: z.string().nullable(),
        reason: z.string(),
      }),
    ),
  });
}

export type CallerMeaning = z.infer<ReturnType<typeof buildCallerMeaningZodSchema>>;

export function configuredIntakeKeySet(config: VoiceV3AgentConfig): Set<string> {
  return new Set(config.intakeFields.map((f) => f.key));
}
