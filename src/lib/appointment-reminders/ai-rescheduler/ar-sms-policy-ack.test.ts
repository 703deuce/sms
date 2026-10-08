import { describe, expect, it } from "vitest";
import {
  classifyPolicyAckUtterance,
  consumePolicyAck,
  createPolicyWarningRecord,
  fingerprintArSmsPolicy,
  gateArSmsCalendarWriteByPolicy,
  interpretPolicyAckResponse,
  markPolicyAckAccepted,
  messageLooksLikeSchedulingWithoutPolicyAccept,
} from "./ar-sms-policy-ack";
import { evaluateArSmsActionPolicy } from "./ar-sms-action-policy";

const startsAt = new Date("2026-10-20T17:00:00.000Z");
const insideNow = new Date("2026-10-20T10:00:00.000Z");

const latePolicy = {
  cutoffMinutes: 1440,
  afterCutoff: "allow_with_warning" as const,
  penaltyType: "lost_session" as const,
};

describe("ar-sms-policy-ack", () => {
  it("blocks calendar write when warning sent but not accepted", () => {
    const evaluation = evaluateArSmsActionPolicy({
      action: "reschedule",
      startsAt,
      now: insideNow,
      policy: latePolicy,
    });
    const gate = gateArSmsCalendarWriteByPolicy({
      meta: {
        arSmsPolicyAck: createPolicyWarningRecord({
          operationId: "op1",
          action: "reschedule",
          policy: latePolicy,
          penaltySummary: "a prepaid session may still count toward your package",
          workspaceId: "ws",
          contactId: "c",
          appointmentId: "a",
        }),
      },
      action: "reschedule",
      startsAt,
      policy: latePolicy,
      now: insideNow,
    });
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe("policy_acceptance_required");
  });

  it("allows write after explicit acceptance", () => {
    const penaltySummary = "a prepaid session may still count toward your package";
    const pending = createPolicyWarningRecord({
      operationId: "op1",
      action: "reschedule",
      policy: latePolicy,
      penaltySummary,
      workspaceId: "ws",
      contactId: "c",
      appointmentId: "a",
    });
    const accepted = markPolicyAckAccepted(pending, { messageText: "Yes" });
    const gate = gateArSmsCalendarWriteByPolicy({
      meta: { arSmsPolicyAck: accepted },
      action: "reschedule",
      startsAt,
      policy: latePolicy,
      now: insideNow,
    });
    expect(gate.allowed).toBe(true);
  });

  it("does not treat availability question as acceptance", () => {
    expect(messageLooksLikeSchedulingWithoutPolicyAccept("Can we do Friday afternoon?")).toBe(true);
    const decision = interpretPolicyAckResponse({
      body: "Can we do Friday afternoon?",
      contextInterpretation: {
        intent: "availability_question",
        intent_confidence: "high",
        conversation_relationship: "new_request",
        appointment_reference: "current_reminder",
        pending_offer_response: "none",
        customer_authorization: "request_only",
        needs_clarification: false,
        relevant_context: "asking times",
      },
    });
    expect(decision).toBe("other");
  });

  it("accepts explicit yes utterance", () => {
    expect(classifyPolicyAckUtterance("Yes")).toBe("accept");
    expect(classifyPolicyAckUtterance("no")).toBe("decline");
  });

  it("does not reuse acceptance for a different action", () => {
    const penaltySummary = "a prepaid session may still count toward your package";
    const accepted = markPolicyAckAccepted(
      createPolicyWarningRecord({
        operationId: "op1",
        action: "reschedule",
        policy: latePolicy,
        penaltySummary,
        workspaceId: "ws",
        contactId: "c",
        appointmentId: "a",
      }),
      { messageText: "Yes" },
    );
    const gate = gateArSmsCalendarWriteByPolicy({
      meta: { arSmsPolicyAck: accepted },
      action: "cancel",
      startsAt,
      policy: { ...latePolicy, afterCutoff: "allow_with_warning" },
      now: insideNow,
    });
    expect(gate.allowed).toBe(false);
  });

  it("requires new acceptance when policy fingerprint changes", () => {
    const penaltySummary = "a prepaid session may still count toward your package";
    const accepted = markPolicyAckAccepted(
      createPolicyWarningRecord({
        operationId: "op1",
        action: "reschedule",
        policy: latePolicy,
        penaltySummary,
        workspaceId: "ws",
        contactId: "c",
        appointmentId: "a",
      }),
      { messageText: "Yes" },
    );
    const stricterPolicy = {
      ...latePolicy,
      penaltyType: "percent_of_price" as const,
      penaltyPercent: 50,
    };
    const gate = gateArSmsCalendarWriteByPolicy({
      meta: { arSmsPolicyAck: accepted },
      action: "reschedule",
      startsAt,
      policy: stricterPolicy,
      now: insideNow,
    });
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe("policy_changed");
  });

  it("blocks write after acknowledgment consumed", () => {
    const penaltySummary = "a prepaid session may still count toward your package";
    const accepted = markPolicyAckAccepted(
      createPolicyWarningRecord({
        operationId: "op1",
        action: "reschedule",
        policy: latePolicy,
        penaltySummary,
        workspaceId: "ws",
        contactId: "c",
        appointmentId: "a",
      }),
      { messageText: "Yes" },
    );
    const consumed = consumePolicyAck(accepted, "reschedule");
    const gate = gateArSmsCalendarWriteByPolicy({
      meta: { arSmsPolicyAck: consumed },
      action: "reschedule",
      startsAt,
      policy: latePolicy,
      now: insideNow,
    });
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe("policy_ack_consumed");
  });

  it("stable fingerprint for same policy snapshot", () => {
    const a = fingerprintArSmsPolicy("cancel", latePolicy, "fee applies");
    const b = fingerprintArSmsPolicy("cancel", latePolicy, "fee applies");
    expect(a).toBe(b);
    const c = fingerprintArSmsPolicy("reschedule", latePolicy, "fee applies");
    expect(c).not.toBe(a);
  });
});
