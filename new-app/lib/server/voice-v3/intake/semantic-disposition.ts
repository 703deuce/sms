export type SemanticDisposition =
  | "APPLIED"
  | "EMPTY_NO_CALLER_EVIDENCE"
  | "INVALID_WITH_CALLER_EVIDENCE"
  | "STALE"
  | "DUPLICATE";

export function classifySemanticDecodeFailure(input: {
  reason: string;
  hasCallerEvidence: boolean;
}): SemanticDisposition {
  if (
    input.hasCallerEvidence &&
    (input.reason === "empty_signal" ||
      input.reason === "empty_arguments" ||
      input.reason === "schema_validation_failed" ||
      input.reason === "invalid_json")
  ) {
    return "INVALID_WITH_CALLER_EVIDENCE";
  }
  if (
    !input.hasCallerEvidence &&
    (input.reason === "empty_signal" || input.reason === "empty_arguments")
  ) {
    return "EMPTY_NO_CALLER_EVIDENCE";
  }
  if (input.hasCallerEvidence) {
    return "INVALID_WITH_CALLER_EVIDENCE";
  }
  return "EMPTY_NO_CALLER_EVIDENCE";
}
