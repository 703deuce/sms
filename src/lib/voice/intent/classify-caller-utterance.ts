import type { WorkflowState } from "@/lib/voice/workflow-engine/types";

export type CallerUtteranceClass =
  | "capability_question"
  | "booking_intent"
  | "availability_question"
  | "confirmation"
  | "transfer"
  | "take_message"
  | "end_call"
  | "general_question"
  | "field_answer"
  | "unknown";

const END_CALL_RE =
  /\b(bye|goodbye|never\s*mind|hang\s*up|stop\s*calling|not\s*interested|don'?t\s*call)\b/i;
const TRANSFER_RE =
  /\b(speak\s+to|talk\s+to|real\s+person|human|agent|representative|manager|operator)\b/i;
const MESSAGE_RE =
  /\b(just\s+(take|leave)\s+a\s+message|call\s+me\s+back|have\s+someone\s+call)\b/i;
const CONFIRM_RE =
  /\b(yes|yeah|yep|sure|correct|right|go ahead|book it|please do|sounds good|that works|confirm|do it|okay|ok)\b/i;

const CAPABILITY_RE =
  /\b(can you|could you|are you able to|do you|is it possible|am i able to|can we|could we)\b[\s\S]{0,80}\b(book|schedule|make an appointment|set up an appointment|get an appointment)\b/i;

const BOOKING_INTENT_RE =
  /\b(i need to|i'd like to|i would like to|i want to|please book|book me|schedule me|set up|make an appointment|need an appointment|need someone to come|come out|send someone|need a (service|visit|appointment)|book a)\b/i;

const AVAILABILITY_RE =
  /\b(what do you have|anything (open|available)|do you have (anything|time|openings)|available (on|this)|open (on|this)|free (on|this)|slots?)\b/i;

const TIME_HINT_RE =
  /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|next week|\d{1,2}(:\d{2})?\s*(am|pm))\b/i;

export type ClassifyCallerUtteranceInput = {
  utterance: string;
  workflowState: WorkflowState;
  hasMissingFields: boolean;
  activeFieldId?: string | null;
  bookingEnabled?: boolean;
  serviceNames?: string[];
};

export type ClassifyCallerUtteranceResult = {
  class: CallerUtteranceClass;
  confidence: "high" | "medium" | "low";
  reason: string;
  suggestedSpeak?: string;
};

export function classifyCallerUtterance(
  input: ClassifyCallerUtteranceInput,
): ClassifyCallerUtteranceResult {
  const utterance = String(input.utterance || "").trim();
  const lower = utterance.toLowerCase();

  if (!utterance) {
    return { class: "unknown", confidence: "low", reason: "empty_utterance" };
  }

  if (END_CALL_RE.test(lower)) {
    return { class: "end_call", confidence: "high", reason: "end_call_phrase" };
  }
  if (TRANSFER_RE.test(lower)) {
    return { class: "transfer", confidence: "high", reason: "transfer_phrase" };
  }
  if (MESSAGE_RE.test(lower)) {
    return { class: "take_message", confidence: "high", reason: "message_phrase" };
  }

  if (
    (input.workflowState === "READY_TO_BOOK" || input.workflowState === "BOOKING_IN_PROGRESS") &&
    CONFIRM_RE.test(lower)
  ) {
    return { class: "confirmation", confidence: "high", reason: "explicit_confirm" };
  }

  if (CAPABILITY_RE.test(lower) && !BOOKING_INTENT_RE.test(lower)) {
    const services =
      input.serviceNames?.length
        ? input.serviceNames.join(" or ")
        : "a service visit or consultation";
    return {
      class: "capability_question",
      confidence: "high",
      reason: "capability_without_commitment",
      suggestedSpeak: input.bookingEnabled
        ? `Yes, I can help you book an appointment — we offer ${services}. Would you like to schedule one?`
        : "I'm not able to book appointments on this line right now, but I can take a message for the team.",
    };
  }

  if (BOOKING_INTENT_RE.test(lower)) {
    return { class: "booking_intent", confidence: "high", reason: "explicit_booking_intent" };
  }

  if (
    AVAILABILITY_RE.test(lower) ||
    (TIME_HINT_RE.test(lower) &&
      /\b(available|open|slot|time|appointment|schedule)\b/i.test(lower))
  ) {
    if (input.hasMissingFields) {
      return {
        class: "field_answer",
        confidence: "medium",
        reason: "availability_premature_while_fields_missing",
      };
    }
    return {
      class: "availability_question",
      confidence: "medium",
      reason: "availability_or_time_question",
    };
  }

  if (
    input.workflowState === "COLLECTING_FIELDS" ||
    input.workflowState === "INTENT_DISCOVERY" ||
    input.activeFieldId
  ) {
    if (/\b(how much|pricing|price|cost|hours|open|close|where are you located)\b/i.test(lower)) {
      return { class: "general_question", confidence: "medium", reason: "faq_during_collection" };
    }
    return { class: "field_answer", confidence: "medium", reason: "collection_phase_answer" };
  }

  if (/\b(how much|pricing|price|cost|hours|where)\b/i.test(lower)) {
    return { class: "general_question", confidence: "medium", reason: "general_faq" };
  }

  return { class: "unknown", confidence: "low", reason: "unclassified" };
}
