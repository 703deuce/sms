import { describe, expect, it } from "vitest";
import {
  arSmsContextInterpretationSchema,
  fallbackArSmsContextInterpretation,
  parseArSmsContextInterpretation,
} from "./ar-sms-context-schema";

describe("arSmsContextInterpretationSchema", () => {
  it("rejects customer-facing reply fields", () => {
    const withReply = {
      intent: "acknowledgment",
      intent_confidence: "high",
      conversation_relationship: "acknowledgment",
      appointment_reference: "current_reminder",
      pending_offer_response: "none",
      customer_authorization: "none",
      needs_clarification: false,
      relevant_context: "Customer thanked after reschedule.",
      suggested_reply: "You're welcome!",
    };
    expect(parseArSmsContextInterpretation(withReply)).toBeNull();
  });

  it("parses acknowledgment example A", () => {
    const parsed = parseArSmsContextInterpretation({
      intent: "acknowledgment",
      intent_confidence: "high",
      conversation_relationship: "acknowledgment",
      appointment_reference: "current_reminder",
      pending_offer_response: "none",
      customer_authorization: "none",
      needs_clarification: false,
      relevant_context: "Thanks after completed reschedule.",
    });
    expect(parsed?.intent).toBe("acknowledgment");
    expect(parsed?.customer_authorization).toBe("none");
  });

  it("parses ambiguous attendance with clarification", () => {
    const parsed = parseArSmsContextInterpretation({
      intent: "ambiguous_attendance",
      intent_confidence: "medium",
      conversation_relationship: "new_request",
      appointment_reference: "current_reminder",
      pending_offer_response: "none",
      customer_authorization: "none",
      needs_clarification: true,
      clarification_topic: "cancel vs reschedule",
      relevant_context: "Customer cannot make it tomorrow.",
    });
    expect(parsed?.needs_clarification).toBe(true);
    expect(parsed?.customer_authorization).toBe("none");
  });

  it("fallback marks unclear authorization", () => {
    const fb = fallbackArSmsContextInterpretation("invalid_json");
    expect(fb.customer_authorization).toBe("unclear");
    expect(fb.needs_clarification).toBe(true);
    expect(arSmsContextInterpretationSchema.safeParse(fb).success).toBe(true);
  });
});
