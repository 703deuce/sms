import { getRecordingBookingLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { getRecordingPaymentLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import { getRecordingHandoffLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-handoff";
import type { CertScenario } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import { bookingCertFail } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";

function assertNoPayments(id: string) {
  if (getRecordingPaymentLedger().length > 0) {
    bookingCertFail(id, "SEMANTIC_ROUTING", `payment ledger writes: ${getRecordingPaymentLedger().length}`);
  }
}

function assertNoBookingCreates(id: string) {
  const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
  if (creates.length > 0) {
    bookingCertFail(id, "SEMANTIC_ROUTING", `booking creates: ${creates.length}`);
  }
}

/** Negation / keyword-trap scenarios — real DeepSeek intent agent (no keyword shortcut). */
export function buildSemanticNegationScenarios(): CertScenario[] {
  return [
    {
      id: "negation-no-pay-want-book",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550701");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550701",
          body: "I don't want to make a payment. I just want to book.",
        });
        assertNoPayments("negation-no-pay-want-book");
      },
    },
    {
      id: "negation-no-book-want-price",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550702");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550702",
          body: "Don't book anything. Just send me the price.",
        });
        assertNoBookingCreates("negation-no-book-want-price");
        assertNoPayments("negation-no-book-want-price");
      },
    },
    {
      id: "negation-paid-need-schedule",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550703");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550703",
          body: "I already paid. I need to schedule.",
        });
        assertNoPayments("negation-paid-need-schedule");
      },
    },
    {
      id: "negation-pay-when-here-not-deposit",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550704");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550704",
          body: "Can somebody come tomorrow? I can pay when they get here.",
        });
        assertNoPayments("negation-pay-when-here-not-deposit");
      },
    },
    {
      id: "negation-no-appointment-callback",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550705");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550705",
          body: "I don't want an appointment. Have someone call me.",
        });
        assertNoBookingCreates("negation-no-appointment-callback");
        if (getRecordingHandoffLedger().length < 1) {
          bookingCertFail("negation-no-appointment-callback", "SEMANTIC_ROUTING", "expected callback handoff");
        }
      },
    },
    {
      id: "negation-payment-method-faq",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550706");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550706",
          body: "Do you take payments over the phone?",
        });
        assertNoPayments("negation-payment-method-faq");
      },
    },
    {
      id: "negation-pricing-not-payment-request",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550707");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550707",
          body: "How much would I have to pay?",
        });
        assertNoPayments("negation-pricing-not-payment-request");
      },
    },
    {
      id: "negation-failed-payment-not-new-link",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550708");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550708",
          body: "My appointment payment failed.",
        });
        assertNoPayments("negation-failed-payment-not-new-link");
      },
    },
    {
      id: "wrong-number-exact",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { runLeadRecoveryIntentAgent } = await import("@/lib/mctb/lead-recovery/intent-agent");
        const intent = await runLeadRecoveryIntentAgent({ message: "Wrong number." });
        if (intent.primary_intent !== "WRONG_NUMBER") {
          bookingCertFail("wrong-number-exact", "SEMANTIC_ROUTING", intent.primary_intent);
        }
      },
    },
    {
      id: "wrong-number-not-service",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { runLeadRecoveryIntentAgent } = await import("@/lib/mctb/lead-recovery/intent-agent");
        const intent = await runLeadRecoveryIntentAgent({
          message: "I thought I had the wrong number, but do you repair water heaters?",
        });
        if (intent.primary_intent === "WRONG_NUMBER") {
          bookingCertFail("wrong-number-not-service", "SEMANTIC_ROUTING", "forced WRONG_NUMBER");
        }
      },
    },
    {
      id: "wrong-number-schedule-question",
      group: "SEMANTIC_NEGATION",
      run: async () => {
        resetE2eRecordingState();
        const { runLeadRecoveryIntentAgent } = await import("@/lib/mctb/lead-recovery/intent-agent");
        const intent = await runLeadRecoveryIntentAgent({
          message: "Is this the wrong number to schedule an appointment?",
        });
        if (intent.primary_intent === "WRONG_NUMBER") {
          bookingCertFail("wrong-number-schedule-question", "SEMANTIC_ROUTING", "forced WRONG_NUMBER");
        }
      },
    },
  ];
}
