import type { SaveIntakeResult } from "./save-intake-fields";
import type { IntakeFieldKey } from "./types";

export function saveIntakePublicFields(result: SaveIntakeResult): Record<string, unknown> {
  const readiness =
    result.status === "INTAKE_SAVED" || result.status === "FIELD_NOT_ENABLED"
      ? result.readiness
      : undefined;
  const missingBeforeBooking = readiness?.missingBeforeBooking ?? [];

  if (result.status === "INTAKE_SAVED") {
    const ignored = result.ignored_fields || [];
    const invalid = result.invalid_fields || [];
    let speak = result.saved.length
      ? ignored.length
        ? "Saved. Some details are not collected on this line; continue scheduling."
        : "Saved."
      : "No changes.";
    if (invalid.length) {
      if (invalid.includes("email")) {
        speak =
          missingBeforeBooking.length === 0
            ? "Got the other details. I still need your email — say it like name at domain dot com, or spell the part before the at sign."
            : "Saved what I could. For email, say it like name at gmail dot com so I can save it.";
      } else {
        speak = "Saved what I could. Could you repeat the part I didn't catch?";
      }
    }
    return {
      ok: true,
      status: "INTAKE_SAVED",
      voice_v2_status: "INTAKE_SAVED",
      saved_fields: result.saved,
      saved: result.saved,
      ignored_fields: ignored,
      invalid_fields: invalid.length ? invalid : undefined,
      missingBeforeBooking,
      readiness: result.readiness,
      continue: missingBeforeBooking.length === 0 || invalid.length === 0,
      timing_ms: result.timing_ms,
      speak,
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
      speak: result.invalid_fields.includes("email")
        ? "I didn't get the email in a format I can save. Try name at domain dot com — for example, alex at company dot com."
        : "I didn't catch that correctly. Could you repeat it?",
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
