import type { VoiceV3TransferFallback } from "./types";

/** Map legacy wizard transferFallback strings to canonical fallback enum. */
export function mapWizardTransferFallback(raw: string | null | undefined): VoiceV3TransferFallback {
  const v = (raw ?? "return_to_ai").trim().toLowerCase();
  switch (v) {
    case "callback":
    case "request_callback":
      return "REQUEST_CALLBACK";
    case "take_message":
    case "message":
      return "TAKE_MESSAGE";
    case "end_call":
    case "hangup":
      return "END_CALL";
    case "return_to_ai":
    case "continue_with_amy":
    case "continue":
    default:
      return "RETURN_TO_AGENT";
  }
}
