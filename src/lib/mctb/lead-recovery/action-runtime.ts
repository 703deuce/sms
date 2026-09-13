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
import { finalizeMctbOutboundSms } from "@/lib/mctb/sms-channel";
import { authorizeProviderWrite } from "@/lib/mctb/lead-recovery/provider-write-gate";

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
  /** Epoch captured when consequential action was armed — required for provider writes. */
  writeEpoch?: number;
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
  if (process.env.LR_CERT_E2E === "1") {
    return process.env.LR_E2E_BOOKING_URL || "https://book.example.test/acme-schedule";
  }
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
  try {
    await deliverMctbHandoffNotifications({
      workspaceId: input.workspaceId,
      handoffEventId: event.id,
      eventType,
      urgent: eventType === "urgent_detected",
      facts: customerFacts,
      derived: { requestedAction: input.intent.primary_intent },
      conversationId: input.conversationId,
    });
  } catch {
    /* notification failure must not crash turn — customer reply must stay truthful */
  }
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
        reply = url ? `Book here: ${url}` : "We'll text you a booking link shortly.";
        action = "booking_link_sent";
        break;
      }
      case "AI_BOOK": {
        delegateAiBooking = true;
        action = "ai_book_delegate";
        if (!reply) reply = "Checking availability — one moment.";
        break;
      }
      case "CREATE_CALLBACK_REQUEST": {
        await notifyBusiness(ctx, "callback_requested");
        if (!reply) reply = "Got it — we'll call you back soon.";
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
        if (!reply) reply = "Our team will follow up shortly.";
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
            "I can't start a payment without an authorized amount. Our team will send a link shortly.";
          action = "payment_amount_required";
          break;
        }
        if (ctx.writeEpoch !== undefined) {
          const auth = await authorizeProviderWrite({
            workspaceId: ctx.workspaceId,
            conversationId: ctx.conversationId,
            action: "SEND_TEXT_TO_PAY",
            writeEpoch: ctx.writeEpoch,
          });
          if (!auth.ok) {
            reply = auth.customerMessage;
            action = "payment_stale_blocked";
            break;
          }
        }
        const { createAndSendPaymentRequest } = await import("@/lib/payment-requests/service");
        const idempotencyKey = `lr-t2p:${ctx.conversationId}:${ctx.intent.primary_intent}`;
        try {
          const payResult = await createAndSendPaymentRequest({
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
          if (payResult && "smsFailed" in payResult && payResult.smsFailed) {
            reply = "Your payment link is ready but I couldn't text it. Our team will follow up.";
            action = "payment_sms_failed";
          } else {
            reply = "Payment link sent by text.";
            action = "payment_request_sent";
          }
        } catch {
          reply = "Couldn't start payment — our team will follow up.";
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
          reply = "What would you like to know?";
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
    reply = "Thanks — we'll be in touch shortly.";
  }

  return {
    reply: finalizeMctbOutboundSms(reply),
    action,
    delegateAiBooking,
    suppressContact,
    endAutomation,
    escalateHuman,
  };
}
