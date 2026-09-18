import { z } from "zod";

/**
 * Shape Astra should emit via Structured Outputs (one object per extraction turn).
 * Keys must match VoiceV3BusinessConfig.intakeFields[].key.
 */
export const voiceV3IntakeExtractionSchema = z.object({
  field_updates: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string(),
        status: z.enum(["CAPTURED", "CONFIRMED", "CORRECTED"]).optional(),
        evidence: z.string().optional(),
      }),
    )
    .default([]),
  caller_intent: z
    .enum(["unknown", "book", "reschedule", "cancel", "question", "transfer"])
    .optional(),
  notes_for_planner: z.string().optional(),
});

export type VoiceV3IntakeExtraction = z.infer<typeof voiceV3IntakeExtractionSchema>;

export function parseVoiceV3IntakeExtraction(raw: unknown): VoiceV3IntakeExtraction {
  return voiceV3IntakeExtractionSchema.parse(raw);
}
