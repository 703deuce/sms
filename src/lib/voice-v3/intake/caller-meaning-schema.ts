import { z } from "zod";

const voiceV3GoalSchema = z.enum([
  "UNKNOWN",
  "GENERAL",
  "BOOK_APPOINTMENT",
  "REQUEST_CALLBACK",
  "REQUEST_TRANSFER",
]);

/**
 * Strict semantic contract for GPT-6 Astra Structured Outputs.
 * No workflow ownership fields (stage, required_action, offer_set_id, etc.).
 */
export const callerMeaningZodSchema = z.object({
  active_goal: voiceV3GoalSchema,
  captured_fields: z.array(
    z.object({
      key: z.string(),
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
      key: z.string(),
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

export type CallerMeaning = z.infer<typeof callerMeaningZodSchema>;

export const CALLER_MEANING_STRUCTURED_OUTPUT_NAME = "voice_v3_caller_meaning";

export function parseCallerMeaning(raw: unknown): CallerMeaning {
  return callerMeaningZodSchema.parse(raw);
}

export function safeParseCallerMeaning(
  raw: unknown,
): { ok: true; data: CallerMeaning } | { ok: false; error: string } {
  const result = callerMeaningZodSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, data: result.data };
}
