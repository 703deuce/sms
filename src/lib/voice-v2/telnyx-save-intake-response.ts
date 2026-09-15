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
