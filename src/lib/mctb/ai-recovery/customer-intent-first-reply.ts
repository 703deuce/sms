import "server-only";

import type { MctbAiBookingInboundResult } from "@/lib/mctb/ai-booking/conversation-runtime-types";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import {
  faqIntentForKnowledgeReply,
  shouldTryKnowledgeBeforeTransactionalFlow,
} from "@/lib/mctb/ai-recovery/customer-intent-first-heuristics";
import { generateApprovedInformationSmsReply } from "@/lib/mctb/lead-recovery/approved-information-reply";
import { loadLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import type {
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";
import { finalizeMctbOutboundSms } from "@/lib/mctb/sms-channel";

const BOOKING_INTENTS = new Set<LeadRecoveryIntent>([
  "BOOKING_REQUEST",
  "AVAILABILITY_QUESTION",
  "SPECIFIC_TIME_REQUEST",
  "RESCHEDULE_REQUEST",
]);

const FAQ_INTENTS = new Set<LeadRecoveryIntent>([
  "BUSINESS_HOURS",
  "BUSINESS_FAQ",
  "BUSINESS_LOCATION",
  "SERVICE_AREA_CHECK",
  "GENERAL_INQUIRY",
  "PRICING_QUESTION",
]);

/**
 * Answer from approved business knowledge when the customer is asking — before booking links or field collection.
 */
export async function tryKnowledgeFirstSmsReply(input: {
  workspaceId: string;
  conversationId: string;
  customerMessage: string;
  classified: StructuredLeadIntent;
  config: LeadRecoveryWorkspaceConfig;
}): Promise<MctbAiBookingInboundResult | null> {
  const state = await loadLeadRecoveryState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });
  const session = await getMctbAiBookingSessionStore().get(input.conversationId);
  const bookingWorkflowActive =
    session?.stage === "AWAITING_SLOT_SELECTION" ||
    state.phase === "AWAITING_SLOT_SELECTION" ||
    state.activeSpecialist === "SCHEDULING";
  const collectActive =
    state.phase === "COLLECT" ||
    state.missingFields.length > 0 ||
    state.pendingAction?.action === "COLLECT_FIELD";

  if (
    !shouldTryKnowledgeBeforeTransactionalFlow({
      classified: input.classified,
      customerMessage: input.customerMessage,
      collectActive,
      bookingWorkflowActive,
    })
  ) {
    return null;
  }

  const primaryForFaq = faqIntentForKnowledgeReply(input.classified);
  const intentForReply: StructuredLeadIntent = {
    ...input.classified,
    primary_intent: primaryForFaq,
  };
  const faq = await generateApprovedInformationSmsReply({
    workspaceId: input.workspaceId,
    customerMessage: input.customerMessage,
    structuredIntent: intentForReply,
    config: input.config,
  });

  let reply = faq.reply.trim();
  if (!reply) return null;

  const wantsBooking =
    input.classified.booking_requested ||
    BOOKING_INTENTS.has(input.classified.primary_intent);
  if (faq.grounded && wantsBooking && !reply.toLowerCase().includes("book")) {
    reply = `${reply} Want help scheduling? Tell me what day works.`;
  }

  if (!faq.grounded && !FAQ_INTENTS.has(input.classified.primary_intent)) {
    return null;
  }

  if (!faq.grounded) {
    reply =
      input.classified.needs_clarification
        ? "Happy to help — what would you like to know about our business, or were you hoping to schedule something?"
        : reply;
  }

  return {
    handled: true,
    reply: finalizeMctbOutboundSms(reply),
    action: faq.grounded ? "approved_info" : "conversation_clarify",
  };
}
