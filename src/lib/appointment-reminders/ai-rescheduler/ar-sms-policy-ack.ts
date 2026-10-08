import { createHash } from "node:crypto";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import type { ArSmsContextInterpretation } from "./context-agent/ar-sms-context-schema";
import {
  type ArSmsActionEvaluation,
  type ArSmsActionKind,
  type ArSmsActionPolicyConfig,
  evaluateArSmsActionPolicy,
  formatArSmsPenaltySummary,
} from "./ar-sms-action-policy";

export type ArSmsPolicyAckPhase = "warning_delivered" | "accepted" | "declined";

export type ArSmsPolicyAckSnapshot = {
  cutoffMinutes: number;
  afterCutoff: string;
  penaltyType: string;
  penaltyPercent?: number;
  penaltyFixedAmountCents?: number;
  penaltyCustomText?: string;
  penaltySummary: string;
};

export type ArSmsPolicyAckRecord = {
  operationId: string;
  action: ArSmsActionKind;
  phase: ArSmsPolicyAckPhase;
  policyFingerprint: string;
  policySnapshot: ArSmsPolicyAckSnapshot;
  warningDeliveredAt: string;
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  conversationId?: string;
  acceptedAt?: string;
  acceptedMessageText?: string;
  acceptedProviderMessageId?: string;
  declinedAt?: string;
  declinedMessageText?: string;
  consumedAt?: string;
  consumedFor?: "cancel" | "reschedule";
};

export const AR_SMS_POLICY_ACK_META_KEY = "arSmsPolicyAck";

export function getArSmsPolicyAck(
  meta: AppointmentMetadata | null | undefined,
): ArSmsPolicyAckRecord | null {
  const raw = meta?.[AR_SMS_POLICY_ACK_META_KEY];
  if (!raw || typeof raw !== "object") return null;
  return raw as ArSmsPolicyAckRecord;
}

export function fingerprintArSmsPolicy(
  action: ArSmsActionKind,
  policy: ArSmsActionPolicyConfig,
  penaltySummary: string,
): string {
  const payload = JSON.stringify({
    action,
    cutoffMinutes: policy.cutoffMinutes ?? 0,
    afterCutoff: policy.afterCutoff ?? "contact_business",
    penaltyType: policy.penaltyType ?? "none",
    penaltyPercent: policy.penaltyPercent ?? null,
    penaltyFixedAmountCents: policy.penaltyFixedAmountCents ?? null,
    penaltyCustomText: policy.penaltyCustomText?.trim() ?? null,
    penaltySummary,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildArSmsPolicyAckSnapshot(
  policy: ArSmsActionPolicyConfig,
  penaltySummary: string,
): ArSmsPolicyAckSnapshot {
  return {
    cutoffMinutes: policy.cutoffMinutes ?? 0,
    afterCutoff: policy.afterCutoff ?? "contact_business",
    penaltyType: policy.penaltyType ?? "none",
    penaltyPercent: policy.penaltyPercent,
    penaltyFixedAmountCents: policy.penaltyFixedAmountCents,
    penaltyCustomText: policy.penaltyCustomText,
    penaltySummary,
  };
}

export function buildLatePolicyWarningCopy(input: {
  action: ArSmsActionKind;
  penaltySummary: string;
  whenLabel: string;
  cutoffMinutes: number;
}): string {
  const window =
    input.cutoffMinutes >= 1440 && input.cutoffMinutes % 1440 === 0
      ? `${Math.round(input.cutoffMinutes / 1440)} day(s)`
      : input.cutoffMinutes >= 60 && input.cutoffMinutes % 60 === 0
        ? `${Math.round(input.cutoffMinutes / 60)} hour(s)`
        : `${input.cutoffMinutes} minutes`;
  const consequence = input.penaltySummary.endsWith(".")
    ? input.penaltySummary
    : `${input.penaltySummary}.`;
  if (input.action === "cancel") {
    return `Cancelling within ${window} of your appointment on ${input.whenLabel} means ${consequence} Would you like to continue? Reply YES to accept this policy and confirm cancellation, or NO to keep your appointment.`;
  }
  return `Rescheduling within ${window} of your appointment on ${input.whenLabel} means ${consequence} Would you like to continue? Reply YES to accept and pick a new time, or NO to keep your current time.`;
}

const ACCEPT_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|continue|proceed|go ahead|that's fine|that is fine|i understand|i agree|sounds good)\.?$/i;
const DECLINE_RE =
  /^(no|nope|nah|never mind|nevermind|don't|do not|stop|keep it|keep my appointment)\.?$/i;

export function classifyPolicyAckUtterance(body: string): "accept" | "decline" | "other" {
  const t = body.trim();
  if (!t) return "other";
  if (ACCEPT_RE.test(t)) return "accept";
  if (DECLINE_RE.test(t)) return "decline";
  return "other";
}

/** Scheduling availability is never implicit policy acceptance. */
export function messageLooksLikeSchedulingWithoutPolicyAccept(body: string): boolean {
  const t = body.toLowerCase();
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(t)) return true;
  if (/\b(morning|afternoon|evening|tonight|tomorrow)\b/.test(t)) return true;
  if (/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/.test(t)) return true;
  if (/\bwhat time|available|availability|openings|slots\b/.test(t)) return true;
  if (/\bmove it|reschedule|different (day|time)\b/.test(t) && !ACCEPT_RE.test(body.trim())) return true;
  return false;
}

export function interpretPolicyAckResponse(input: {
  body: string;
  contextInterpretation?: ArSmsContextInterpretation | null;
}): "accept" | "decline" | "other" {
  const literal = classifyPolicyAckUtterance(input.body);
  if (literal === "accept" || literal === "decline") return literal;

  const interp = input.contextInterpretation;
  if (!interp) return "other";

  if (interp.customer_authorization === "rejection_of_pending_action") {
    return "decline";
  }

  if (messageLooksLikeSchedulingWithoutPolicyAccept(input.body)) {
    return "other";
  }

  if (
    interp.customer_authorization === "confirmation_of_pending_action" &&
    interp.pending_offer_response !== "rejection"
  ) {
    if (interp.intent === "availability_question") return "other";
    if (interp.intent === "reschedule_request" && messageLooksLikeSchedulingWithoutPolicyAccept(input.body)) {
      return "other";
    }
    return "accept";
  }

  return "other";
}

export function hasValidAcceptedPolicyAck(input: {
  meta: AppointmentMetadata | null | undefined;
  action: ArSmsActionKind;
  evaluation: ArSmsActionEvaluation;
  policy: ArSmsActionPolicyConfig;
}): boolean {
  if (!input.evaluation.requiresPolicyWarning) return true;
  const penaltySummary =
    input.evaluation.penaltySummary || formatArSmsPenaltySummary(input.policy) || "";
  const fingerprint = fingerprintArSmsPolicy(input.action, input.policy, penaltySummary);
  const ack = getArSmsPolicyAck(input.meta);
  if (!ack) return false;
  if (ack.action !== input.action) return false;
  if (ack.phase !== "accepted") return false;
  if (ack.policyFingerprint !== fingerprint) return false;
  if (ack.consumedAt) return false;
  return true;
}

export type ArSmsPolicyWriteGateResult =
  | { allowed: true; ack: ArSmsPolicyAckRecord | null }
  | { allowed: false; code: string; customerMessage: string };

export function gateArSmsCalendarWriteByPolicy(input: {
  meta: AppointmentMetadata | null | undefined;
  action: ArSmsActionKind;
  startsAt: Date;
  policy: ArSmsActionPolicyConfig;
  now?: Date;
}): ArSmsPolicyWriteGateResult {
  const evaluation = evaluateArSmsActionPolicy({
    action: input.action,
    startsAt: input.startsAt,
    policy: input.policy,
    now: input.now,
  });
  if (!evaluation.allowsAutomatedAction) {
    return {
      allowed: false,
      code: "action_blocked_by_policy",
      customerMessage:
        input.action === "cancel"
          ? "Cancellation by text isn't available this close to your appointment. Please contact the business directly."
          : "Rescheduling by text isn't available this close to your appointment. Please contact the business directly.",
    };
  }
  if (!evaluation.requiresPolicyWarning) {
    return { allowed: true, ack: null };
  }
  const penaltySummary =
    evaluation.penaltySummary || formatArSmsPenaltySummary(input.policy) || "";
  const fingerprint = fingerprintArSmsPolicy(input.action, input.policy, penaltySummary);
  const ack = getArSmsPolicyAck(input.meta);
  if (!ack || ack.action !== input.action) {
    return {
      allowed: false,
      code: "policy_acceptance_required",
      customerMessage:
        "We need your explicit confirmation of the late-change policy before we can update your appointment. Reply YES to accept the policy, or NO to keep your appointment.",
    };
  }
  if (ack.phase === "declined") {
    return {
      allowed: false,
      code: "policy_declined",
      customerMessage: "No problem — your appointment stays as scheduled. Text us anytime if you need help.",
    };
  }
  if (ack.phase !== "accepted") {
    return {
      allowed: false,
      code: "policy_acceptance_required",
      customerMessage:
        "Please reply YES to accept the late-change policy and continue, or NO to keep your current appointment.",
    };
  }
  if (ack.policyFingerprint !== fingerprint) {
    return {
      allowed: false,
      code: "policy_changed",
      customerMessage:
        "The policy for this appointment changed. We'll send an updated notice — please confirm again before we make changes.",
    };
  }
  if (ack.consumedAt) {
    return {
      allowed: false,
      code: "policy_ack_consumed",
      customerMessage:
        "Please start again if you still need to change this appointment — we'll remind you of any applicable policy.",
    };
  }
  return { allowed: true, ack };
}

export function mergePolicyAckIntoMetadata(
  meta: AppointmentMetadata,
  ack: ArSmsPolicyAckRecord | null,
): AppointmentMetadata {
  if (!ack) {
    const next = { ...meta };
    delete next[AR_SMS_POLICY_ACK_META_KEY];
    return next;
  }
  return { ...meta, [AR_SMS_POLICY_ACK_META_KEY]: ack };
}

export function createPolicyWarningRecord(input: {
  operationId: string;
  action: ArSmsActionKind;
  policy: ArSmsActionPolicyConfig;
  penaltySummary: string;
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  replySessionId?: string;
  conversationId?: string;
}): ArSmsPolicyAckRecord {
  const penaltySummary = input.penaltySummary.trim();
  return {
    operationId: input.operationId,
    action: input.action,
    phase: "warning_delivered",
    policyFingerprint: fingerprintArSmsPolicy(input.action, input.policy, penaltySummary),
    policySnapshot: buildArSmsPolicyAckSnapshot(input.policy, penaltySummary),
    warningDeliveredAt: new Date().toISOString(),
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
    conversationId: input.conversationId,
  };
}

export function markPolicyAckAccepted(
  ack: ArSmsPolicyAckRecord,
  input: { messageText: string; providerMessageId?: string },
): ArSmsPolicyAckRecord {
  if (
    input.providerMessageId &&
    ack.acceptedProviderMessageId === input.providerMessageId
  ) {
    return ack;
  }
  return {
    ...ack,
    phase: "accepted",
    acceptedAt: new Date().toISOString(),
    acceptedMessageText: input.messageText.trim().slice(0, 500),
    acceptedProviderMessageId: input.providerMessageId,
  };
}

export function markPolicyAckDeclined(
  ack: ArSmsPolicyAckRecord,
  input: { messageText: string },
): ArSmsPolicyAckRecord {
  return {
    ...ack,
    phase: "declined",
    declinedAt: new Date().toISOString(),
    declinedMessageText: input.messageText.trim().slice(0, 500),
  };
}

export function consumePolicyAck(
  ack: ArSmsPolicyAckRecord,
  consumedFor: "cancel" | "reschedule",
): ArSmsPolicyAckRecord {
  return {
    ...ack,
    consumedAt: new Date().toISOString(),
    consumedFor,
  };
}

export function awaitingPolicyAcceptance(
  meta: AppointmentMetadata | null | undefined,
  action?: ArSmsActionKind,
): boolean {
  const ack = getArSmsPolicyAck(meta);
  if (!ack || ack.phase !== "warning_delivered") return false;
  if (action && ack.action !== action) return false;
  return true;
}
