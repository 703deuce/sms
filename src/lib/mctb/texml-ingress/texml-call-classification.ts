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
    // TeXML MCTB ingress: greeting + voicemail playback is automated, not a human answer.
    status = "NO_ANSWER";
    disposition = "missed_no_answer";
  } else if (raw === "no-answer" || raw === "noanswer") {
    status = "NO_ANSWER";
    disposition = "missed_no_answer";
  }

  return {
    direction: "inbound",
    status,
    disposition,
    answeredAt: null,
    hangupCause: input.hangupCause || input.texmlCallStatus || null,
  };
}
