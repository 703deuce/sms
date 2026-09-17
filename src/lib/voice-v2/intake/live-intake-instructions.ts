import type { IntakeFieldKey, VoiceV2IntakeSchema } from "./types";
import { BUILTIN_INTAKE_FIELD_KEYS } from "./wizard-config";

/** True when Voice V2 intake is the sole live field authority (Step 1 booking). */
export function useVoiceV2IntakeAuthority(capabilities: string[]): boolean {
  return (
    capabilities.includes("book_appointments") || capabilities.includes("take_messages")
  );
}

const REQ_LABEL: Record<string, string> = {
  OPTIONAL: "optional (never block booking)",
  REQUIRED_FOR_RECORD: "required for record (collect when natural; never block booking)",
  REQUIRED_BEFORE_BOOKING: "required before booking (must be valid before BOOK)",
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
    "VOICE V2 INTAKE AUTHORITY (published wizard schema — built-in and custom fields):",
    ...(options?.oneAmy
      ? [
          "Collect intake conversationally. The live transcript is your memory; do not re-ask known information.",
          "Booking intent alone is conversational only — never call voice_v2_save_intake_fields merely because the caller wants to book or schedule.",
          'Example: Caller: "I need to make an appointment." Amy: "Absolutely. I can help with that. What name should I put it under?" — no tool for intent alone.',
          "When the caller volunteers one or more configured field values, remember all of them. Ask only for what is still missing.",
          "Call voice_v2_save_intake_fields only when saving real field values (batch every new value from the turn in one call when possible).",
          "Do not call save after every single word, and never call save solely to enter booking mode.",
          "Do not call save for scheduling date/time alone — use conversation memory until FIND; scheduling-only saves are handled without blocking intake fields.",
          "Do not save booking-intent phrases as service_reason (for example 'book an appointment').",
          "Latest explicit correction wins (for example email corrected mid-call).",
          "Before voice_v2_find_availability: briefly acknowledge naturally (for example 'Let me see what I have open for Tuesday') then call FIND.",
          "Before voice_v2_book_offered_slot: briefly acknowledge (for example 'Give me a moment while I lock in that time') then call BOOK.",
          "Never say booked/confirmed/reserved until BOOK returns BOOKING_CONFIRMED.",
          "REQUIRED_FOR_RECORD and OPTIONAL fields must not delay FIND or BOOK.",
        ]
      : []),
    "Requirement levels (strict): REQUIRED_BEFORE_BOOKING gates BOOK only. REQUIRED_FOR_RECORD must not block BOOK. OPTIONAL never blocks. DISABLED fields do not exist — never ask, save, or mention.",
    "Use voice_v2_save_intake_fields with wizard field keys (including custom keys) when persisting caller-provided values.",
    "FIELD_NOT_ENABLED means the field is disabled — continue booking; not failure, not callback.",
    "Once missingBeforeBooking is empty, follow voice_v2_next_stage from the save tool (scheduling vs FIND).",
    "For email: normalize speech to user@domain.tld before save (at→@, dot→., no filler phrases).",
  ];

  if (schema.fields.length) {
    lines.push("Enabled wizard fields (dynamic — includes custom):");
    for (const f of schema.fields) {
      lines.push(
        `- ${f.key}: ${REQ_LABEL[f.requirementLevel] || f.requirementLevel}; if missing ask: "${f.questionText}"`,
      );
    }
  } else {
    lines.push("Enabled fields: (none configured — runtime compile applies defaults).");
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
