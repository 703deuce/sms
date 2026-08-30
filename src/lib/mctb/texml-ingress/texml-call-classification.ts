import type { ClassifyInboundCallInput } from "@/lib/agents/missed-call-text-back/classify";

/** Map TeXML terminal CallStatus → MCTB inbound call classification input. */
export function buildMctbTexmlTerminalCallInput(input: {
  texmlCallStatus?: string | null;
  callDuration?: string | number | null;
  hangupCause?: string | null;
}): ClassifyInboundCallInput {
  const raw = String(input.texmlCallStatus || input.hangupCause || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  const duration = Number(input.callDuration);
  const hadConversation = Number.isFinite(duration) && duration > 3;

  let status = "NO_ANSWER";
  let disposition = "missed_no_answer";

  if (raw === "busy") {
    status = "BUSY";
    disposition = "missed_busy";
  } else if (raw === "failed") {
    status = "FAILED";
    disposition = "missed_failed";
  } else if (raw === "canceled" || raw === "cancelled") {
    status = "CANCELLED";
    disposition = "missed_rejected";
  } else if (raw === "completed" || raw === "in-progress" || raw === "inprogress") {
    status = hadConversation ? "COMPLETED" : "NO_ANSWER";
    disposition = hadConversation ? "answered" : "missed_no_answer";
  } else if (raw === "no-answer" || raw === "noanswer") {
    status = "NO_ANSWER";
    disposition = "missed_no_answer";
  }

  return {
    direction: "inbound",
    status,
    disposition,
    answeredAt: hadConversation ? new Date() : null,
    hangupCause: input.hangupCause || input.texmlCallStatus || null,
  };
}
