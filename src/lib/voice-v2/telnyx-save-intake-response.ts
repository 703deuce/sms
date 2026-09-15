import type { SaveIntakeResult } from "./intake/save-intake-fields";

export function formatVoiceV2SaveIntakeTelnyxResponse(result: SaveIntakeResult): Record<string, unknown> {
  if (result.status === "INTAKE_SAVED") {
    return {
      ok: true,
      status: "INTAKE_SAVED",
      voice_v2_status: "INTAKE_SAVED",
      saved: result.saved,
      readiness: result.readiness,
      timing_ms: result.timing_ms,
      speak: result.saved.length ? "Saved." : "No changes.",
    };
  }
  if (result.status === "FIELD_NOT_ENABLED") {
    const ready = result.readiness.missingBeforeBooking.length === 0;
    return {
      ok: true,
      status: "FIELD_NOT_ENABLED",
      voice_v2_status: "FIELD_NOT_ENABLED",
      disabled_fields: result.disabled_fields,
      readiness: result.readiness,
      timing_ms: result.timing_ms,
      speak: ready
        ? "That detail is not collected on this line. Continue scheduling with find availability."
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
      timing_ms: result.timing_ms,
      speak: "I didn't catch that correctly. Could you repeat it?",
    };
  }
  return {
    ok: false,
    status: "SESSION_UNAVAILABLE",
    voice_v2_status: "SESSION_UNAVAILABLE",
    timing_ms: result.timing_ms,
    speak: "Okay.",
  };
}
