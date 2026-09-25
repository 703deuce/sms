import type { CallOutcomeBadge } from "./display";

export type CallAttentionBadge =
  | "Needs attention"
  | "Transfer failed"
  | "Urgent"
  | "Emergency"
  | "Spam"
  | "Solicitor"
  | "Unanswered question";

export type CallRowOutcomeInput = {
  outcome?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  isLead?: boolean | null;
  leadScore?: number | null;
  status?: string;
  mockOutcome?: string | null;
  hasKnowledgeGap?: boolean;
  transfers?: Array<{ status?: string | null; answered?: boolean | null }>;
};

export type CallListOutcomeDisplay = {
  primary: CallOutcomeBadge;
  attention: CallAttentionBadge | null;
};

function outcomeLower(call: CallRowOutcomeInput): string {
  return String(call.outcome || "").toLowerCase();
}

export function callTransferFailed(call: CallRowOutcomeInput): boolean {
  const outcomeLc = outcomeLower(call);
  if (outcomeLc.includes("transfer_failed") || outcomeLc.includes("transfer_exhausted")) {
    return true;
  }
  const xfer = call.transfers?.[0];
  return xfer?.status === "failed";
}

function mockPrimary(mock: string): CallOutcomeBadge | null {
  const map: Record<string, CallOutcomeBadge> = {
    "Lead Captured": "Lead Captured",
    Resolved: "Resolved",
    Voice: "Voice",
    Voicemail: "Voicemail",
    "No Answer": "No Answer",
    "Appointment Booked": "Appointment Booked",
    "Message Taken": "Message Taken",
    Transferred: "Transferred",
  };
  return map[mock] ?? null;
}

export function deriveCallListOutcomeDisplay(call: CallRowOutcomeInput): CallListOutcomeDisplay {
  if (call.mockOutcome) {
    const fromMock = mockPrimary(String(call.mockOutcome));
    if (fromMock) {
      return { primary: fromMock, attention: deriveAttentionBadge(call, fromMock) };
    }
  }

  const outcomeLc = outcomeLower(call);

  let primary: CallOutcomeBadge;

  if (callTransferFailed(call)) {
    primary = "Transfer Failed";
  } else if (call.voicemailDetected) {
    primary = "Voicemail";
  } else if (outcomeLc.includes("booking_link_sent")) {
    primary = "Booking Link Sent";
  } else if (
    outcomeLc.includes("appointment_requested") ||
    outcomeLc.includes("request_only")
  ) {
    primary = "Appointment Requested";
  } else if (call.appointmentBooked && !outcomeLc.includes("request")) {
    primary = "Appointment Booked";
  } else if (
    outcomeLc.includes("appointment_booked") ||
    (outcomeLc.includes("booked") && !outcomeLc.includes("link"))
  ) {
    primary = "Appointment Booked";
  } else if (call.transferred) {
    primary = "Transferred";
  } else if (outcomeLc.includes("emergency")) {
    primary = "Emergency";
  } else if (outcomeLc.includes("urgent")) {
    primary = "Urgent";
  } else if (outcomeLc.includes("solicitor")) {
    primary = "Solicitor";
  } else if (outcomeLc.includes("spam")) {
    primary = "Spam";
  } else if (outcomeLc.includes("callback")) {
    primary = "Callback Requested";
  } else if (
    outcomeLc.includes("message_taken") ||
    outcomeLc.includes("message") ||
    outcomeLc.includes("follow_up")
  ) {
    primary = "Message Taken";
  } else if (
    call.isLead ||
    (call.leadScore != null && call.leadScore >= 40) ||
    outcomeLc.includes("lead")
  ) {
    primary = "New Lead";
  } else if (outcomeLc.includes("faq")) {
    primary = "FAQ";
  } else if (outcomeLc.includes("information")) {
    primary = "Information Provided";
  } else if (outcomeLc.includes("no_answer") || call.status === "NO_ANSWER") {
    primary = "No Answer";
  } else if (!outcomeLc || outcomeLc === "no_action" || outcomeLc === "none") {
    primary = "No Action";
  } else if (outcomeLc.includes("completed") || call.status === "COMPLETED") {
    primary = "Completed";
  } else {
    primary = "Completed";
  }

  return { primary, attention: deriveAttentionBadge(call, primary) };
}

export function deriveAttentionBadge(
  call: CallRowOutcomeInput,
  primary: CallOutcomeBadge,
): CallAttentionBadge | null {
  if (call.hasKnowledgeGap) {
    return "Unanswered question";
  }

  const outcomeLc = outcomeLower(call);

  if (primary !== "Transfer Failed" && callTransferFailed(call)) {
    return "Transfer failed";
  }
  if (primary !== "Emergency" && outcomeLc.includes("emergency")) {
    return "Emergency";
  }
  if (primary !== "Urgent" && outcomeLc.includes("urgent")) {
    return "Urgent";
  }
  if (primary !== "Spam" && outcomeLc.includes("spam") && !outcomeLc.includes("solicitor")) {
    return "Spam";
  }
  if (primary !== "Solicitor" && outcomeLc.includes("solicitor")) {
    return "Solicitor";
  }
  if (
    primary === "Callback Requested" ||
    outcomeLc.includes("callback") ||
    outcomeLc.includes("failed_transfer")
  ) {
    if (primary !== "Callback Requested" && outcomeLc.includes("callback")) {
      return "Needs attention";
    }
  }

  return null;
}

export function deriveCallDetailMaterialOutcomes(
  call: CallRowOutcomeInput,
): CallOutcomeBadge[] {
  const { primary, attention } = deriveCallListOutcomeDisplay(call);
  const facts = new Set<CallOutcomeBadge>();
  facts.add(primary);

  const outcomeLc = outcomeLower(call);
  if (
    (call.appointmentBooked ||
      outcomeLc.includes("appointment_booked") ||
      (outcomeLc.includes("booked") && !outcomeLc.includes("link"))) &&
    primary !== "Appointment Booked"
  ) {
    facts.add("Appointment Booked");
  }
  if (callTransferFailed(call) && primary !== "Transfer Failed") {
    facts.add("Transfer Failed");
  }
  if (call.transferred && primary !== "Transferred") {
    facts.add("Transferred");
  }
  if (outcomeLc.includes("booking_link_sent") && primary !== "Booking Link Sent") {
    facts.add("Booking Link Sent");
  }
  if (
    (outcomeLc.includes("appointment_requested") || outcomeLc.includes("request_only")) &&
    primary !== "Appointment Requested"
  ) {
    facts.add("Appointment Requested");
  }
  if (attention === "Transfer failed" && !facts.has("Transfer Failed")) {
    facts.add("Transfer Failed");
  }
  return [...facts];
}

/** Event-style material outcomes for analytics (one call may increment multiple keys). */
export function deriveCallMaterialOutcomeEvents(call: CallRowOutcomeInput): CallOutcomeBadge[] {
  const events = new Set(deriveCallDetailMaterialOutcomes(call));
  if (call.voicemailDetected) {
    events.add("Voicemail");
  }
  if (call.hasKnowledgeGap) {
    // Represented in UI as knowledge-gap attention; no separate badge type.
  }
  return [...events];
}

export function countTransfersAnsweredOnCall(
  transfers: Array<{ status?: string | null; answered?: boolean | null }> | undefined,
): number {
  if (!transfers?.length) return 0;
  return transfers.filter((t) => t.status === "completed" && t.answered === true).length;
}

export function callHasTransferFailedEvent(call: CallRowOutcomeInput): boolean {
  if (callTransferFailed(call)) return true;
  return (
    call.transfers?.some(
      (t) =>
        t.status === "failed" ||
        t.status === "exhausted" ||
        (t.status === "completed" && t.answered === false),
    ) ?? false
  );
}
