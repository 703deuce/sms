import type { VoiceV3RecoveryCode } from "../recovery/types";

/** Map provider / transport failure tokens to recovery codes (FIND/BOOK/RESCHEDULE/CANCEL). */
export function mapProviderFailureToRecoveryCode(reason: string): VoiceV3RecoveryCode {
  const r = reason.toLowerCase();
  if (
    r.includes("auth") ||
    r.includes("401") ||
    r.includes("403") ||
    r.includes("microsoft_token") ||
    r.includes("google_token") ||
    r.includes("google_auth")
  ) {
    return "MICROSOFT_AUTH_FAILED";
  }
  if (r.includes("429") || r.includes("throttl") || r.includes("google_throttled")) {
    return "MICROSOFT_THROTTLED";
  }
  if (r.includes("5xx") || r.includes("500") || r.includes("502") || r.includes("503")) {
    return "MICROSOFT_TEMPORARY_FAILURE";
  }
  if (
    r.includes("network") ||
    r.includes("econnreset") ||
    r.includes("econnrefused") ||
    r.includes("enotfound") ||
    r.includes("socket")
  ) {
    return "MICROSOFT_TEMPORARY_FAILURE";
  }
  if (r.includes("504") || r.includes("gateway timeout")) {
    return "MICROSOFT_TEMPORARY_FAILURE";
  }
  if (r.includes("timeout") || r.includes("etimedout") || r.includes("microsoft_timeout")) {
    return "PROVIDER_TIMEOUT";
  }
  if (r.includes("404") || r.includes("not_found") || r.includes("not found")) {
    return "APPOINTMENT_NOT_FOUND";
  }
  if (r.includes("409") || r.includes("conflict")) {
    return "SLOT_NOT_AVAILABLE";
  }
  if (r.includes("400") || r.includes("validation") || r.includes("malformed")) {
    return "MICROSOFT_TEMPORARY_FAILURE";
  }
  if (r.includes("outcome_unknown") || r.includes("outcome uncertain")) {
    return "BOOKING_OUTCOME_UNKNOWN";
  }
  if (r.includes("stale_conversation_revision") || r.includes("stale_offer")) {
    return "STALE_CONVERSATION_REVISION";
  }
  if (r.includes("booking_confirmation_required")) {
    return "BOOKING_CONFIRMATION_REQUIRED";
  }
  if (r.includes("intake_incomplete") || r.includes("missing_required")) {
    return "MISSING_REQUIRED_INFORMATION";
  }
  return "MICROSOFT_TEMPORARY_FAILURE";
}
