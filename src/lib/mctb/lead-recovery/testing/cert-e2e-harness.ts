import { getPrisma } from "@/lib/db";
import { handleMctbLeadRecoveryInboundSms } from "@/lib/mctb/lead-recovery/conversation-runtime";
import { analyzeSmsBody } from "@/lib/sms/segment-encoding";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { getRecordingSmsOutbox } from "@/lib/voice/testing/headless/recording-sms";
import { resetLeadRecoveryE2eRecording } from "@/lib/mctb/lead-recovery/testing/recording/e2e-mode";
import { recordCertE2eOutboundSms } from "@/lib/mctb/lead-recovery/testing/cert-sms-metrics";
import { certResultsTraceEnabled, recordCertTurnTrace } from "@/lib/mctb/lead-recovery/testing/cert-results-trace";

export const LR_E2E_WORKSPACE_ID = process.env.LR_CERT_E2E_WORKSPACE || "lr_cert_e2e";
const BOOKING_URL = "https://book.example.test/acme-schedule";

export type E2eTurnTrace = {
  customerInput: string;
  ingestDuplicate?: boolean;
  lrHandled: boolean;
  lrAction?: string;
  lrReply: string;
  outboundSms: string | null;
  smsAnalysis: ReturnType<typeof analyzeSmsBody> | null;
  providerMessageId?: string;
};

export async function ensureLeadRecoveryE2eWorkspace(): Promise<void> {
  const prisma = getPrisma();
  const leadRecoveryConfig = {
    enabled: true,
    version: 2,
    globalMode: "STANDARD",
    enabledIntents: [
      "GENERAL_INQUIRY",
      "SERVICE_REQUEST",
      "EMERGENCY_OR_URGENT",
      "CALLBACK_REQUEST",
      "BOOKING_REQUEST",
      "PAYMENT_REQUEST",
      "PAYMENT_STATUS_QUESTION",
      "COMPLAINT",
      "OPT_OUT",
      "WRONG_NUMBER",
      "EXISTING_CUSTOMER_ISSUE",
      "BUSINESS_HOURS",
      "UNKNOWN",
      "LANGUAGE_PREFERENCE",
      "PRICING_QUESTION",
      "BUSINESS_FAQ",
    ],
    paymentPolicy: {
      textToPayEnabled: true,
      amountAuthority: "configured_fixed_fee",
      fixedFeeAmountMinor: 8900,
      fixedFeeCurrency: "usd",
    },
    intentPolicies: {
      BOOKING_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["AI_BOOK"],
      },
      PAYMENT_STATUS_QUESTION: {
        enabled: true,
        collect: [],
        actions: ["CHECK_PAYMENT_STATUS"],
      },
      PRICING_QUESTION: {
        enabled: true,
        collect: [],
        actions: ["CUSTOMER_MESSAGE"],
        customerMessage: "We'll share pricing options shortly.",
      },
      BUSINESS_FAQ: {
        enabled: true,
        collect: [],
        actions: ["CUSTOMER_MESSAGE"],
        customerMessage: "Good question — our team can explain options.",
      },
      PAYMENT_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["SEND_TEXT_TO_PAY"],
      },
      CALLBACK_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
        customerMessage: "Got it — we'll call you back soon.",
      },
      EMERGENCY_OR_URGENT: {
        enabled: true,
        collect: ["ADDRESS"],
        actions: ["SEND_OWNER_SMS", "CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
        customerMessage: "We're on it.",
      },
    },
    actionCapabilities: [
      "SEND_BOOKING_LINK",
      "AI_BOOK",
      "CREATE_CALLBACK_REQUEST",
      "SEND_OWNER_SMS",
      "SEND_TEXT_TO_PAY",
      "CUSTOMER_MESSAGE",
      "ESCALATE_HUMAN",
      "SUPPRESS_CONTACT",
      "END_AUTOMATION",
      "CHECK_PAYMENT_STATUS",
    ],
    policyHealth: "READY",
  };

  await prisma.workspace.upsert({
    where: { id: LR_E2E_WORKSPACE_ID },
    create: {
      id: LR_E2E_WORKSPACE_ID,
      name: "LR E2E Cert",
      slug: "lr-cert-e2e-workspace",
      customFieldsConfig: {
        mctb: {
          leadRecovery: leadRecoveryConfig,
          aiBooking: {
            enabled: true,
            provider: "microsoft",
            entitled: true,
            serviceName: "Cert HVAC Service",
            calendarId: "cert-calendar-e2e",
          },
        },
      },
    },
    update: {
      customFieldsConfig: {
        mctb: {
          leadRecovery: leadRecoveryConfig,
          aiBooking: {
            enabled: true,
            provider: "microsoft",
            entitled: true,
            serviceName: "Cert HVAC Service",
            calendarId: "cert-calendar-e2e",
          },
        },
      },
    },
  });

  process.env.LR_E2E_BOOKING_URL = BOOKING_URL;
  process.env.LR_CERT_E2E_NOW = "2026-09-13T12:00:00.000Z";
}

/** Restore booking-link-only policy for legacy booking-link E2E scenarios. */
export async function configureE2eBookingLinkPolicy(): Promise<void> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: LR_E2E_WORKSPACE_ID },
    select: { customFieldsConfig: true },
  });
  const root = (ws?.customFieldsConfig || {}) as Record<string, unknown>;
  const mctb = (root.mctb || {}) as Record<string, unknown>;
  const lr = (mctb.leadRecovery || {}) as Record<string, unknown>;
  const intentPolicies = (lr.intentPolicies || {}) as Record<string, unknown>;
  await prisma.workspace.update({
    where: { id: LR_E2E_WORKSPACE_ID },
    data: {
      customFieldsConfig: {
        ...root,
        mctb: {
          ...mctb,
          leadRecovery: {
            ...lr,
            intentPolicies: {
              ...intentPolicies,
              BOOKING_REQUEST: {
                enabled: true,
                collect: [],
                actions: ["SEND_BOOKING_LINK"],
              },
            },
          },
        },
      },
    },
  });
}

export async function configureE2eAiBookingPolicy(): Promise<void> {
  await ensureLeadRecoveryE2eWorkspace();
}

export async function createE2eConversation(customerPhone = "+15555550100"): Promise<{
  conversationId: string;
  contactId: string;
}> {
  const prisma = getPrisma();
  let contact = await prisma.contact.findFirst({
    where: { workspaceId: LR_E2E_WORKSPACE_ID, phone: customerPhone },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: LR_E2E_WORKSPACE_ID,
        phone: customerPhone,
        firstName: "Cert",
        lastName: "Customer",
      },
    });
  }
  const conv = await prisma.conversation.create({
    data: {
      workspaceId: LR_E2E_WORKSPACE_ID,
      contactId: contact.id,
      channel: "sms",
      status: "OPEN",
    },
  });
  return { conversationId: conv.id, contactId: contact.id };
}

export async function runLeadRecoveryCustomerTurn(input: {
  conversationId: string;
  contactId: string;
  customerPhone: string;
  body: string;
  providerMessageId?: string;
  sendOutboundSms?: boolean;
}): Promise<E2eTurnTrace> {
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  process.env.LR_CERT_E2E = "1";

  const lr = await handleMctbLeadRecoveryInboundSms({
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId: input.conversationId,
    contactId: input.contactId,
    customerPhone: input.customerPhone,
    body: input.body,
    providerMessageId: input.providerMessageId,
  });

  let outboundSms: string | null = null;
  if (
    input.sendOutboundSms !== false &&
    lr.handled &&
    lr.reply?.trim() &&
    lr.action !== "duplicate_inbound_ignored"
  ) {
    await sendQuickSms({
      workspaceId: LR_E2E_WORKSPACE_ID,
      to: input.customerPhone,
      body: lr.reply,
      demoBypass: true,
      idempotencyKey: `lr-e2e:${input.conversationId}:${input.body.slice(0, 20)}`,
    }).catch(() => undefined);
    const last = getRecordingSmsOutbox().at(-1);
    outboundSms = last?.body ?? lr.reply;
  } else if (lr.handled) {
    outboundSms = lr.reply || null;
  }

  const smsBody = outboundSms || "";
  if (smsBody.trim()) {
    recordCertE2eOutboundSms(smsBody);
  }
  const trace: E2eTurnTrace = {
    customerInput: input.body,
    lrHandled: lr.handled,
    lrAction: lr.handled ? lr.action : undefined,
    lrReply: lr.handled ? lr.reply : "",
    outboundSms,
    smsAnalysis: smsBody ? analyzeSmsBody(smsBody) : null,
    providerMessageId: input.providerMessageId,
  };
  if (certResultsTraceEnabled()) {
    recordCertTurnTrace(trace);
  }
  return trace;
}

export function resetE2eRecordingState() {
  process.env.LR_CERT_E2E = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  resetLeadRecoveryE2eRecording();
}
