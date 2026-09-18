import { z } from "zod";

/**
 * Shape Astra should emit via Structured Outputs (one object per extraction turn).
 * Keys must match VoiceV3BusinessConfig.intakeFields[].key.
 * OpenAI strict JSON schema: use .nullable() instead of .optional().
 */
export const voiceV3IntakeExtractionSchema = z.object({
  field_updates: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
      status: z.enum(["CAPTURED", "CONFIRMED", "CORRECTED"]).nullable(),
      evidence: z.string().nullable(),
    }),
  ),
  caller_intent: z
    .enum(["unknown", "book", "reschedule", "cancel", "question", "transfer"])
    .nullable(),
  notes_for_planner: z.string().nullable(),
});

export type VoiceV3IntakeExtraction = z.infer<typeof voiceV3IntakeExtractionSchema>;

function normalizeExtractionRaw(raw: unknown): z.input<typeof voiceV3IntakeExtractionSchema> {
  const base =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);
  const updates = Array.isArray(base.field_updates) ? base.field_updates : [];
  return {
    field_updates: updates
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const item = row as Record<string, unknown>;
        return {
          key: String(item.key ?? ""),
          value: String(item.value ?? ""),
          status:
            item.status === "CAPTURED" ||
            item.status === "CONFIRMED" ||
            item.status === "CORRECTED"
              ? item.status
              : null,
          evidence: typeof item.evidence === "string" ? item.evidence : null,
        };
      }),
    caller_intent:
      base.caller_intent === "unknown" ||
      base.caller_intent === "book" ||
      base.caller_intent === "reschedule" ||
      base.caller_intent === "cancel" ||
      base.caller_intent === "question" ||
      base.caller_intent === "transfer"
        ? base.caller_intent
        : null,
    notes_for_planner: typeof base.notes_for_planner === "string" ? base.notes_for_planner : null,
  };
}

export function parseVoiceV3IntakeExtraction(raw: unknown): VoiceV3IntakeExtraction {
  return voiceV3IntakeExtractionSchema.parse(normalizeExtractionRaw(raw));
}
