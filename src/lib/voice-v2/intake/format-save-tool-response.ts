import type { SaveIntakeResult } from "./save-intake-fields";
import type { IntakeFieldKey } from "./types";

export function saveIntakePublicFields(result: SaveIntakeResult): Record<string, unknown> {
  const readiness =
    result.status === "INTAKE_SAVED" || result.status === "FIELD_NOT_ENABLED"
      ? result.readiness
      : undefined;
  const missingBeforeBooking = readiness?.missingBeforeBooking ?? [];

  if (result.status === "INTAKE_SAVED") {
    const ignored = (result as { ignored_fields?: IntakeFieldKey[] }).ignored_fields || [];
    return {
      ok: true,
      status: "INTAKE_SAVED",
      voice_v2_status: "INTAKE_SAVED",
      saved_fields: result.saved,
      saved: result.saved,
      ignored_fields: ignored,
      missingBeforeBooking,
      readiness: result.readiness,
      continue: true,
      timing_ms: result.timing_ms,
      speak: result.saved.length
        ? ignored.length
          ? "Saved. Some details are not collected on this line; continue scheduling."
          : "Saved."
        : "No changes.",
    };
  }

  if (result.status === "FIELD_NOT_ENABLED") {
    return {
      ok: true,
      status: "FIELD_NOT_ENABLED",
      voice_v2_status: "FIELD_NOT_ENABLED",
      ignored_fields: result.ignored_fields,
      saved_fields: result.saved_fields,
      disabled_fields: result.ignored_fields,
      missingBeforeBooking,
      readiness: result.readiness,
      continue: true,
      timing_ms: result.timing_ms,
      speak:
        missingBeforeBooking.length === 0
          ? "That detail is not collected on this line. Continue with find availability."
          : "That field is not collected on this line. Continue with the remaining required details only.",
    };
  }

  if (result.status === "INTAKE_VALIDATION_ERROR") {
    return {
      ok: false,
      status: "INTAKE_VALIDATION_ERROR",
      voice_v2_status: "INTAKE_VALIDATION_ERROR",
      invalid_fields: result.invalid_fields,
      disabled_fields: result.disabled_fields,
      continue: false,
      timing_ms: result.timing_ms,
      speak: "I didn't catch that correctly. Could you repeat it?",
    };
  }

  return {
    ok: false,
    status: "SESSION_UNAVAILABLE",
    voice_v2_status: "SESSION_UNAVAILABLE",
    continue: false,
    timing_ms: result.timing_ms,
    speak: "Okay.",
  };
}
