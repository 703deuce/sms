import { getIntakeReadiness } from "../intake/readiness";
import type { VoiceV2CallContext } from "../intake/types";
import type { VoiceV2PinnedSchemaSnapshot } from "./types";

function fieldValuePresent(ctx: VoiceV2CallContext, key: string): boolean {
  const row = ctx.intakeState[key];
  if (!row?.value?.trim()) return false;
  return row.status === "CAPTURED" || row.status === "CONFIRMED" || row.status === "CORRECTED";
}

/** Generic pinned-schema participation snapshot at call end (evidence only — never sole recovery trigger). */
export function buildPinnedSchemaSnapshot(ctx: VoiceV2CallContext): VoiceV2PinnedSchemaSnapshot {
  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  const captured_fields: string[] = [];
  const captured_custom_fields: string[] = [];

  for (const field of ctx.intakeSchema.fields) {
    if (!fieldValuePresent(ctx, field.key)) continue;
    captured_fields.push(field.key);
    const builtin = [
      "name",
      "full_name",
      "phone",
      "email",
      "address",
      "service_reason",
      "scheduling_preference",
    ];
    if (!builtin.includes(field.key)) {
      captured_custom_fields.push(field.key);
    }
  }

  const qualification_field_keys = ctx.capabilities?.qualificationFieldKeys?.map(String) ?? [];

  return {
    captured_fields,
    captured_custom_fields,
    missing_required_for_record: readiness.missingForRecord,
    missing_required_before_booking: readiness.missingBeforeBooking,
    qualification_field_keys,
    urgency_field_keys: [],
    booking_prerequisite_field_keys: readiness.missingBeforeBooking,
  };
}

export function hasPartialIntakeEvidence(snapshot: VoiceV2PinnedSchemaSnapshot): boolean {
  return (
    snapshot.captured_fields.length > 0 ||
    snapshot.captured_custom_fields.length > 0
  );
}
