import type { LeadRecoveryCollectField } from "@/lib/mctb/lead-recovery/types";
import type { PolicyEvaluationResult } from "@/lib/mctb/lead-recovery/types";
import type { PlatformResponseId } from "@/lib/mctb/platform-sender/platform-response-ids";
import { isPlatformResponseId } from "@/lib/mctb/platform-sender/platform-response-ids";

export type PlatformResponseSelection = {
  responseId: PlatformResponseId;
  /** Structured variables only — never model-authored prose. */
  variables: {
    businessName?: string;
    bookingUrl?: string;
    callerFirstName?: string;
  };
};

function collectFieldToResponse(field: LeadRecoveryCollectField): PlatformResponseId {
  switch (field) {
    case "NAME":
      return "ASK_NAME";
    case "ADDRESS":
      return "ASK_LOCATION";
    case "URGENCY":
      return "ASK_URGENCY";
    case "CALLBACK_TIME":
      return "ASK_CALLBACK_TIME";
    case "REASON":
    case "ISSUE_DESCRIPTION":
    case "SERVICE_CATEGORY":
      return "ASK_NEED";
    default:
      return "ACKNOWLEDGE_NEED";
  }
}

function runtimeActionToResponse(
  action: string,
  input: { bookingEntitled: boolean; hasBookingUrl: boolean },
): PlatformResponseId | null {
  if (action === "opt_out") return "OPT_OUT_ACK";
  if (action === "callback_requested" || action === "callback_stale_blocked") {
    return "CALLBACK_CONFIRMED";
  }
  if (action === "booking_link_sent") {
    return input.bookingEntitled && input.hasBookingUrl ? "SEND_BOOKING_LINK" : "HANDOFF_OWNER_FOLLOWUP";
  }
  if (
    action.startsWith("collect_") ||
    action === "lead_recovery" ||
    action === "customer_message" ||
    action === "ai_booking_clarify"
  ) {
    const field = action.replace(/^collect_/, "") as LeadRecoveryCollectField;
    if (action.startsWith("collect_")) return collectFieldToResponse(field);
    return "ACKNOWLEDGE_NEED";
  }
  if (
    action.startsWith("ai_book") ||
    action === "ai_book_delegate" ||
    action === "ai_booking" ||
    action === "ai_booking_fallback"
  ) {
    return input.bookingEntitled && input.hasBookingUrl ? "SEND_BOOKING_LINK" : "HANDOFF_OWNER_FOLLOWUP";
  }
  if (
    action === "escalate_human" ||
    action === "route_to_team" ||
    action === "lead_recovery_safe_fallback" ||
    action.startsWith("send_owner") ||
    action.startsWith("send_team")
  ) {
    return "HANDOFF_OWNER_FOLLOWUP";
  }
  if (action === "approved_info" || action === "approved_info_fallback") {
    return "SAFE_FALLBACK";
  }
  if (action.startsWith("payment_")) {
    return "HANDOFF_OWNER_FOLLOWUP";
  }
  return null;
}

function policyPrimaryToResponse(
  policy: PolicyEvaluationResult,
  input: { bookingEntitled: boolean; hasBookingUrl: boolean },
): PlatformResponseId | null {
  const step = policy.nextActions[0];
  if (!step) return null;
  switch (step.action) {
    case "COLLECT_FIELD":
      return step.field ? collectFieldToResponse(step.field) : "ACKNOWLEDGE_NEED";
    case "SEND_BOOKING_LINK":
      return input.bookingEntitled && input.hasBookingUrl ? "SEND_BOOKING_LINK" : "HANDOFF_OWNER_FOLLOWUP";
    case "AI_BOOK":
      return input.bookingEntitled && input.hasBookingUrl ? "SEND_BOOKING_LINK" : "HANDOFF_OWNER_FOLLOWUP";
    case "CREATE_CALLBACK_REQUEST":
      return "CALLBACK_CONFIRMED";
    case "ESCALATE_HUMAN":
    case "ROUTE_TO_TEAM":
    case "SEND_OWNER_SMS":
    case "SEND_TEAM_SMS":
      return "HANDOFF_OWNER_FOLLOWUP";
    case "ANSWER_APPROVED_INFORMATION":
      return "SAFE_FALLBACK";
    case "SUPPRESS_CONTACT":
      return "OPT_OUT_ACK";
    case "CUSTOMER_MESSAGE":
      return "ACKNOWLEDGE_NEED";
    default:
      return null;
  }
}

export function selectPlatformResponseForLeadRecovery(input: {
  runtimeAction: string;
  policy?: PolicyEvaluationResult;
  bookingEntitled: boolean;
  bookingUrl: string | null;
  businessName: string;
  callerFirstName?: string | null;
  explicitResponseId?: string | null;
}): PlatformResponseSelection {
  if (input.explicitResponseId && isPlatformResponseId(input.explicitResponseId)) {
    return {
      responseId: input.explicitResponseId,
      variables: {
        businessName: input.businessName,
        bookingUrl: input.bookingUrl || undefined,
        callerFirstName: input.callerFirstName || undefined,
      },
    };
  }

  const hasBookingUrl = Boolean(input.bookingUrl?.trim());
  const fromPolicy =
    input.policy && policyPrimaryToResponse(input.policy, {
      bookingEntitled: input.bookingEntitled,
      hasBookingUrl,
    });
  const fromAction = runtimeActionToResponse(input.runtimeAction, {
    bookingEntitled: input.bookingEntitled,
    hasBookingUrl,
  });

  const responseId = fromPolicy || fromAction || "SAFE_FALLBACK";

  if (responseId === "SEND_BOOKING_LINK" && (!input.bookingEntitled || !hasBookingUrl)) {
    return {
      responseId: "HANDOFF_OWNER_FOLLOWUP",
      variables: { businessName: input.businessName },
    };
  }

  return {
    responseId,
    variables: {
      businessName: input.businessName,
      bookingUrl: input.bookingUrl || undefined,
      callerFirstName: input.callerFirstName || undefined,
    },
  };
}
