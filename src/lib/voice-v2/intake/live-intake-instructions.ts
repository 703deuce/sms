import type { IntakeFieldKey, VoiceV2IntakeSchema } from "./types";
import { BUILTIN_INTAKE_FIELD_KEYS } from "./wizard-config";

/** True when Voice V2 intake is the sole live field authority (Step 1 booking). */
export function useVoiceV2IntakeAuthority(capabilities: string[]): boolean {
  return (
    capabilities.includes("book_appointments") || capabilities.includes("take_messages")
  );
}

const REQ_LABEL: Record<string, string> = {
  OPTIONAL: "optional",
  REQUIRED_FOR_RECORD: "required for record (do not block booking)",
  REQUIRED_BEFORE_BOOKING: "required before booking",
};

/**
 * Compiled into receptionist prompt + Telnyx PSTN append — single source for what Amy may ask.
 */
export function buildVoiceV2LiveIntakeInstructions(
  schema: VoiceV2IntakeSchema,
  options?: { oneAmy?: boolean },
): string {
  const enabled = new Set(schema.fields.map((f) => f.key));
  const disabled = BUILTIN_INTAKE_FIELD_KEYS.filter((k) => !enabled.has(k));

  const lines: string[] = [
    "VOICE V2 INTAKE AUTHORITY (sole source for live booking intake):",
    ...(options?.oneAmy
      ? [
          "Do not call intake save solely because the caller wants to book or schedule.",
          "Do not call intake save for a scheduling date or time alone (for example 'tomorrow') — retain it in the conversation.",
          "If the caller already gave a day or time, do not ask for it again.",
          "Do not save booking-intent phrases as service_reason (for example 'book an appointment').",
          "When multiple enabled fields arrive in one utterance, save them in one call.",
          "Every enabled configured intake field (built-in or custom) is memorable — if the caller provides a value, save it and do not ask again unless unclear, invalid, or corrected.",
        ]
      : []),
    "Use voice_v2_save_intake_fields when the caller supplies configured values (including custom wizard field keys).",
    "Use the Voice V2 intake schema as the only source of truth for what information to actively request.",
    "Do not ask for disabled fields. Do not re-ask fields already known in session state or already stated by the caller.",
    "If the caller volunteers a disabled field, acknowledge naturally if appropriate and continue — never treat it as an error, never retry saving it, never switch to callback/message mode because of it.",
    "FIELD_NOT_ENABLED from the save tool means continue booking — not failure, not callback.",
    "Once missingBeforeBooking is empty, follow voice_v2_next_stage from the save tool result (COLLECT_SCHEDULING_PREFERENCE vs FIND_AVAILABILITY). Never callback-close when booking_continue_required is true.",
    "REQUIRED_FOR_RECORD and OPTIONAL fields must not delay FIND/BOOK.",
    "For email: before voice_v2_save_intake_fields, normalize speech to user@domain.tld (convert 'at'→@, 'dot'→., remove spaces). Never send raw spoken filler like 'my email is'.",
  ];

  if (schema.fields.length) {
    lines.push("Enabled fields:");
    for (const f of schema.fields) {
      lines.push(
        `- ${f.key}: ${REQ_LABEL[f.requirementLevel] || f.requirementLevel}; ask only if missing: "${f.questionText}"`,
      );
    }
  } else {
    lines.push("Enabled fields: (none configured — use defaults at runtime compile).");
  }

  if (disabled.length) {
    lines.push(`Disabled fields (never ask, never save): ${disabled.join(", ")}.`);
  }

  return lines.join("\n");
}

export function legacyFieldManifestLeaksDisabledIntake(
  schema: VoiceV2IntakeSchema,
  legacyManifest: Array<{ id: string; label: string; enabled?: boolean }>,
): string[] {
  const enabled = new Set(schema.fields.map((f) => f.key));
  const leaks: string[] = [];
  for (const row of legacyManifest) {
    const key = row.id as IntakeFieldKey;
    if (BUILTIN_INTAKE_FIELD_KEYS.includes(key as (typeof BUILTIN_INTAKE_FIELD_KEYS)[number]) && !enabled.has(key)) {
      leaks.push(row.label || key);
    }
  }
  return leaks;
}
