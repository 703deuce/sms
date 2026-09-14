import { getRecordingBookingLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { getRecordingPaymentLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import type { CertScenario } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import { bookingCertFail } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";

export function buildChangeOfMindScenarios(): CertScenario[] {
  return [
    {
      id: "com-never-mind-pending-booking",
      group: "CHANGE_OF_MIND",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550801");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550801",
          body: "Can somebody come tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550801",
          body: "Never mind.",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length > 0) {
          bookingCertFail("com-never-mind-pending-booking", "CHANGE_OF_MIND", "booking created after never mind");
        }
      },
    },
    {
      id: "com-dont-cancel-keep-booking",
      group: "CHANGE_OF_MIND",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550802");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550802",
          body: "Can somebody come tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550802",
          body: "Don't cancel it.",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length > 0) {
          bookingCertFail("com-dont-cancel-keep-booking", "CHANGE_OF_MIND", "unexpected booking create");
        }
      },
    },
    {
      id: "com-never-mind-payment-keep-appointment",
      group: "CHANGE_OF_MIND",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550803");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550803",
          body: "Send the payment link.",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550803",
          body: "Never mind the payment link. Keep my appointment.",
        });
        if (getRecordingPaymentLedger().length > 1) {
          bookingCertFail("com-never-mind-payment-keep-appointment", "CHANGE_OF_MIND", "duplicate payment");
        }
      },
    },
    {
      id: "com-token-never-mind-but-confirm-time",
      group: "CHANGE_OF_MIND",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550804");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550804",
          body: "Can somebody come tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550804",
          body: "I was going to say never mind, but 3 PM is fine.",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length > 1) {
          bookingCertFail("com-token-never-mind-but-confirm-time", "CHANGE_OF_MIND", "duplicate booking");
        }
      },
    },
    {
      id: "com-dont-send-payment-book-first",
      group: "CHANGE_OF_MIND",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550805");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550805",
          body: "Can I pay my deposit?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550805",
          body: "Don't send the payment link yet. Can you book me first?",
        });
        if (getRecordingPaymentLedger().length > 1) {
          bookingCertFail("com-dont-send-payment-book-first", "CHANGE_OF_MIND", "extra payment");
        }
      },
    },
  ];
}
