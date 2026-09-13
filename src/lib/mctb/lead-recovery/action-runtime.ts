import { getPrisma } from "@/lib/db";
import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { recordMctbHandoffEvent } from "@/lib/mctb/handoff/events";
import { deliverMctbHandoffNotifications } from "@/lib/mctb/handoff/notifications";
import { createMctbLeadSnapshot, buildSnapshotFactsFromCaptured } from "@/lib/mctb/handoff/snapshot";
import type {
  LeadRecoveryActionId,
  LeadRecoveryCollectField,
  LeadRecoveryWorkspaceConfig,
  PolicyEvaluationResult,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";
import { isKnownAction } from "@/lib/mctb/lead-recovery/action-registry";
import { promptForCollectField } from "@/lib/mctb/lead-recovery/field-collection";

export type ActionRuntimeContext = {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  customerEmail?: string | null;
  body: string;
  timezone?: string;
  config: LeadRecoveryWorkspaceConfig;
  intent: StructuredLeadIntent;
  policy: PolicyEvaluationResult;
  collectedFields: Partial<Record<LeadRecoveryCollectField, string>>;
};

export type ActionRuntimeResult = {
  reply: string;
  action: string;
  delegateAiBooking?: boolean;
  suppressContact?: boolean;
  endAutomation?: boolean;
  escalateHuman?: boolean;
};

async function resolveBookingUrl(workspaceId: string, config: LeadRecoveryWorkspaceConfig): Promise<string | null> {
  if (config.bookingLinkId) {
    const prisma = getPrisma();
    const row = await prisma.mctbBookingLink.findFirst({
      where: { workspaceId, id: config.bookingLinkId, active: true },
    });
    if (row?.url) return row.url;
  }
  const aiCfg = await loadMctbAiBookingConfig(workspaceId);
  return resolveFallbackBookingUrl(workspaceId, aiCfg);
}

async function notifyBusiness(
  input: ActionRuntimeContext,
  eventType: "callback_requested" | "urgent_detected" | "human_required",
) {
  const idempotencyKey = `lr:${input.conversationId}:${eventType}:${input.body.slice(0, 24)}`;
  const captured = {
    caller_name: input.customerName,
    service_reason: input.collectedFields.REASON || input.intent.reason_for_contact,
    urgency: input.intent.urgency,
    service_address: input.collectedFields.ADDRESS,
    callback_time: input.collectedFields.CALLBACK_TIME,
  };
  const customerFacts = buildSnapshotFactsFromCaptured(captured, input.customerPhone, [input.body]);
  const snapshot = await createMctbLeadSnapshot({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    triggerEvent: eventType,
    customerFacts,
    aiDerived: { requestedAction: input.intent.primary_intent },
  });
  const { event } = await recordMctbHandoffEvent({
    workspaceId: input.workspaceId,
    eventType,
    idempotencyKey,
    conversationId: input.conversationId,
    leadSnapshotId: snapshot.id,
    metadata: { source: "lead_recovery", intent: input.intent.primary_intent },
  });
  await deliverMctbHandoffNotifications({
    workspaceId: input.workspaceId,
    handoffEventId: event.id,
    eventType,
    urgent: eventType === "urgent_detected",
    facts: customerFacts,
    derived: { requestedAction: input.intent.primary_intent },
    conversationId: input.conversationId,
  });
}

export async function executeLeadRecoveryActions(
  ctx: ActionRuntimeContext,
): Promise<ActionRuntimeResult> {
  let reply = "";
  let action = "lead_recovery";
  let delegateAiBooking = false;
  let suppressContact = false;
  let endAutomation = false;
  let escalateHuman = false;

  for (const step of ctx.policy.nextActions) {
    if (!isKnownAction(step.action)) continue;
    const id = step.action as LeadRecoveryActionId;

    switch (id) {
      case "COLLECT_FIELD": {
        const field = step.field as LeadRecoveryCollectField;
        reply = promptForCollectField(field);
        action = `collect_${field}`;
        return { reply, action };
      }
      case "CUSTOMER_MESSAGE": {
        const template =
          (step.config?.template as string) ||
          ctx.policy.responseConstraints.customerMessageTemplate ||
          reply;
        if (template) reply = template;
        action = "customer_message";
        break;
      }
      case "SEND_BOOKING_LINK": {
        const url = await resolveBookingUrl(ctx.workspaceId, ctx.config);
        reply = url
          ? `You can pick a time here: ${url}`
          : "We'll send you a booking link shortly.";
        action = "booking_link_sent";
        break;
      }
      case "AI_BOOK": {
        delegateAiBooking = true;
        action = "ai_book_delegate";
        if (!reply) reply = "Let me check availability for you.";
        break;
      }
      case "CREATE_CALLBACK_REQUEST": {
        await notifyBusiness(ctx, "callback_requested");
        if (!reply) reply = "Got it — we'll call you back as soon as we can.";
        action = "callback_requested";
        break;
      }
      case "SEND_OWNER_SMS":
      case "SEND_TEAM_SMS":
      case "SEND_EMAIL_SUMMARY": {
        const eventType =
          ctx.intent.urgency === "EMERGENCY" ? "urgent_detected" : "callback_requested";
        await notifyBusiness(ctx, eventType);
        if (!reply && ctx.policy.responseConstraints.customerMessageTemplate) {
          reply = ctx.policy.responseConstraints.customerMessageTemplate;
        }
        action = id.toLowerCase();
        break;
      }
      case "ESCALATE_HUMAN": {
        await notifyBusiness(ctx, "human_required");
        escalateHuman = true;
        if (!reply) reply = "I've connected you with our team — someone will follow up shortly.";
        action = "escalate_human";
        break;
      }
      case "SEND_TEXT_TO_PAY": {
        const payCfg = ctx.config.paymentPolicy;
        if (!payCfg.textToPayEnabled && !ctx.config.actionCapabilities.includes("SEND_TEXT_TO_PAY")) {
          reply = "Payments aren't enabled for automated texts. Our team will follow up.";
          action = "payment_disabled";
          break;
        }
        let amountMinor: number | null = null;
        if (payCfg.amountAuthority === "configured_fixed_fee" && payCfg.fixedFeeAmountMinor) {
          amountMinor = payCfg.fixedFeeAmountMinor;
        }
        if (!amountMinor) {
          reply =
            "I can't start a payment without an authorized amount on file. Our team will send you a secure payment link shortly.";
          action = "payment_amount_required";
          break;
        }
        const { createAndSendPaymentRequest } = await import("@/lib/payment-requests/service");
        const idempotencyKey = `lr-t2p:${ctx.conversationId}:${ctx.intent.primary_intent}`;
        try {
          await createAndSendPaymentRequest({
            workspaceId: ctx.workspaceId,
            customerPhoneE164: ctx.customerPhone,
            amountMinor,
            currency: payCfg.fixedFeeCurrency || "usd",
            description: ctx.collectedFields.REASON || ctx.intent.reason_for_contact || "Payment",
            customerName: ctx.customerName,
            contactId: ctx.contactId,
            conversationId: ctx.conversationId,
            sourceType: "conversation",
            idempotencyKey,
            sendSms: true,
          });
          reply =
            "I've sent a secure payment link by text. Let us know once you've completed payment.";
          action = "payment_request_sent";
        } catch {
          reply = "We couldn't start the payment right now. Our team will follow up.";
          action = "payment_failed";
        }
        break;
      }
      case "SUPPRESS_CONTACT": {
        suppressContact = true;
        if (!reply) reply = "You've been unsubscribed.";
        action = "opt_out";
        break;
      }
      case "END_AUTOMATION": {
        endAutomation = true;
        action = "end_automation";
        break;
      }
      case "ANSWER_APPROVED_INFORMATION": {
        if (!reply) {
          reply =
            "I can only share details we've configured for our business. What would you like to know?";
        }
        action = "approved_info";
        break;
      }
      case "NO_OP":
        break;
      default:
        break;
    }
  }

  if (!reply) {
    reply = "Thanks for your message — we'll be in touch shortly.";
  }

  return {
    reply,
    action,
    delegateAiBooking,
    suppressContact,
    endAutomation,
    escalateHuman,
  };
}
