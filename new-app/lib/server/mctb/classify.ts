export type InboundCallClassification =
  | "outbound"
  | "answered"
  | "voicemail"
  | "missed_no_answer"
  | "missed_busy"
  | "missed_rejected"
  | "missed_failed"
  | "missed_timeout"
  | "abandoned"
  | "unknown";

export type ClassifyInboundCallInput = {
  direction: string;
  status?: string | null;
  disposition?: string | null;
  answeredAt?: Date | null;
  voicemailDetected?: boolean;
  hangupCause?: string | null;
};

export function classifyInboundCallOutcome(input: ClassifyInboundCallInput): InboundCallClassification {
  const direction = String(input.direction || "").toLowerCase();
  if (direction === "outbound") return "outbound";

  if (input.voicemailDetected) return "voicemail";

  const status = String(input.status || "").toUpperCase();
  const disposition = String(input.disposition || "").toLowerCase();
  const cause = String(input.hangupCause || "").toLowerCase();

  const answered =
    Boolean(input.answeredAt) ||
    (status === "COMPLETED" && disposition.includes("answered")) ||
    /answered|bridged/.test(disposition);

  if (answered && !/missed|no.?answer|busy|rejected|timeout|declined/.test(disposition)) {
    return "answered";
  }

  if (status === "BUSY" || /busy/.test(disposition) || cause.includes("busy")) {
    return "missed_busy";
  }
  if (status === "CANCELLED" || /reject|declin/.test(disposition) || cause.includes("reject")) {
    return "missed_rejected";
  }
  if (status === "FAILED" || cause.includes("fail")) {
    return "missed_failed";
  }
  if (
    status === "NO_ANSWER" ||
    status === "MISSED" ||
    /no.?answer|timeout|missed/.test(disposition) ||
    cause.includes("timeout") ||
    cause.includes("no_answer")
  ) {
    return "missed_no_answer";
  }
  if (/abandon/.test(disposition)) return "abandoned";

  if (!answered) return "missed_no_answer";

  return "unknown";
}

export function classificationTriggersMctb(
  classification: InboundCallClassification,
  rules: {
    sendAfterNoAnswer: boolean;
    sendAfterBusy: boolean;
    sendAfterRejected: boolean;
    sendAfterTimeout: boolean;
    sendAfterVoicemail: boolean;
  },
): boolean {
  switch (classification) {
    case "missed_no_answer":
    case "missed_timeout":
    case "abandoned":
      return rules.sendAfterNoAnswer || rules.sendAfterTimeout;
    case "missed_busy":
      return rules.sendAfterBusy;
    case "missed_rejected":
      return rules.sendAfterRejected;
    case "voicemail":
      return rules.sendAfterVoicemail;
    default:
      return false;
  }
}
