import { setRecordingPaymentBehavior } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import { setRecordingSmsNextFailure } from "@/lib/voice/testing/headless/recording-sms";
import { setCertPaymentStatus } from "@/lib/mctb/lead-recovery/payment-status";
import {
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { getRecordingPaymentLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import { getRecordingHandoffLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-handoff";
import {
  loadLeadRecoveryState,
  saveLeadRecoveryState,
  LeadRecoveryStateVersionConflictError,
} from "@/lib/mctb/lead-recovery/state-store";
import { bumpStateVersion, invalidatePendingActions } from "@/lib/mctb/lead-recovery/conversation-guard";
import { createBooking } from "@/lib/mctb/ai-booking/service";
import type { CertScenario } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import { bookingCertFail } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";

export function buildPaymentStatusE2eScenarios(): CertScenario[] {
  const states = ["PAID", "OPEN", "FAILED", "EXPIRED", "UNKNOWN", "PROVIDER_UNAVAILABLE"] as const;
  return states.map((state) => ({
    id: `payment-status-${state.toLowerCase()}`,
    group: "PAYMENT_STATUS",
    run: async () => {
      resetE2eRecordingState();
      setCertPaymentStatus(state);
      const { conversationId, contactId } = await createE2eConversation(`+1555555030${states.indexOf(state)}`);
      const turn = await runLeadRecoveryCustomerTurn({
        conversationId,
        contactId,
        customerPhone: `+1555555030${states.indexOf(state)}`,
        body: "Did my payment go through?",
      });
      if (!turn.lrHandled) {
        bookingCertFail(`payment-status-${state}`, "BROKEN", "not handled");
      }
      if (state === "PAID" && !/went through|paid/i.test(turn.lrReply)) {
        bookingCertFail(`payment-status-${state}`, "COMPLIANCE_FAILURE", turn.lrReply);
      }
      if (state === "UNKNOWN" && /\bpaid\b/i.test(turn.lrReply)) {
        bookingCertFail(`payment-status-${state}`, "COMPLIANCE_FAILURE", "guessed paid");
      }
      if (state === "PROVIDER_UNAVAILABLE" && /\bpaid\b/i.test(turn.lrReply)) {
        bookingCertFail(`payment-status-${state}`, "COMPLIANCE_FAILURE", "inferred paid");
      }
    },
  }));
}

export function buildPaymentFailureMatrixScenarios(): CertScenario[] {
  return [
    {
      id: "payment-sms-fail-no-duplicate",
      group: "PAYMENT_FAILURE",
      run: async () => {
        resetE2eRecordingState();
        setRecordingPaymentBehavior("success");
        const { conversationId, contactId } = await createE2eConversation("+15555550401");
        setRecordingSmsNextFailure(true);
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550401",
          body: "Can I pay my deposit?",
        });
        const first = getRecordingPaymentLedger().length;
        setRecordingSmsNextFailure(false);
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550401",
          body: "Can you resend the payment link?",
        });
        const second = getRecordingPaymentLedger().length;
        if (second > first + 0 && second > 1) {
          bookingCertFail("payment-sms-fail-no-duplicate", "CONCURRENCY_FAILURE", `pays ${second}`);
        }
        if (first !== 1) {
          bookingCertFail("payment-sms-fail-no-duplicate", "PROVIDER_FAILURE", `first creates ${first}`);
        }
      },
    },
    {
      id: "payment-disconnected",
      group: "PAYMENT_FAILURE",
      run: async () => {
        resetE2eRecordingState();
        setRecordingPaymentBehavior("disconnected");
        const { conversationId, contactId } = await createE2eConversation("+15555550402");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550402",
          body: "Send payment link",
        });
        if (getRecordingPaymentLedger().length !== 0) {
          bookingCertFail("payment-disconnected", "PROVIDER_FAILURE", "payment created");
        }
      },
    },
  ];
}

export function buildCrossWorkerScenarios(): CertScenario[] {
  return [
    {
      id: "cross-worker-cas-conflict",
      group: "CROSS_WORKER",
      run: async () => {
        resetE2eRecordingState();
        const ws = (await import("@/lib/mctb/lead-recovery/testing/cert-e2e-harness")).LR_E2E_WORKSPACE_ID;
        const { conversationId } = await createE2eConversation("+15555550501");
        let state = await loadLeadRecoveryState({ workspaceId: ws, conversationId });
        const v10 = state.stateVersion ?? 0;
        state = bumpStateVersion(state);
        await saveLeadRecoveryState(state, { expectedVersion: v10 });
        const v11 = state.stateVersion ?? 0;
        state = invalidatePendingActions(state);
        await saveLeadRecoveryState(state, { expectedVersion: v11 });
        try {
          await saveLeadRecoveryState(
            { ...state, phase: "IDLE", stateVersion: (state.stateVersion ?? 0) + 1 },
            { expectedVersion: v10 },
          );
          bookingCertFail("cross-worker-cas-conflict", "CONCURRENCY_FAILURE", "stale save succeeded");
        } catch (err) {
          if (!(err instanceof LeadRecoveryStateVersionConflictError)) {
            throw err;
          }
        }
      },
    },
    {
      id: "cross-worker-stale-booking-write",
      group: "CROSS_WORKER",
      run: async () => {
        resetE2eRecordingState();
        const ws = (await import("@/lib/mctb/lead-recovery/testing/cert-e2e-harness")).LR_E2E_WORKSPACE_ID;
        const { conversationId, contactId } = await createE2eConversation("+15555550502");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550502",
          body: "Can somebody come tomorrow?",
        });
        const armed = await loadLeadRecoveryState({ workspaceId: ws, conversationId });
        const epoch = armed.pendingAction?.epoch ?? armed.stateVersion ?? 0;
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550502",
          body: "Never mind",
        });
        const result = await createBooking({
          workspaceId: ws,
          conversationId,
          slotId: "cert-slot-3pm",
          customerName: "WorkerA",
          writeEpoch: epoch,
        });
        if (result.ok) {
          bookingCertFail("cross-worker-stale-booking-write", "CONCURRENCY_FAILURE", "worker A wrote booking");
        }
      },
    },
  ];
}

export function buildConversationScenarios(): CertScenario[] {
  return [
    {
      id: "human-request",
      group: "CONVERSATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550601");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550601",
          body: "Can I talk to a person?",
        });
        if (!turn.lrHandled) {
          bookingCertFail("human-request", "BROKEN", "not handled");
        }
        if (getRecordingHandoffLedger().length === 0 && !/team|office|follow up|call/i.test(turn.lrReply)) {
          bookingCertFail("human-request", "POLICY_FAILURE", turn.lrReply);
        }
      },
    },
    {
      id: "who-is-this",
      group: "CONVERSATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550602");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550602",
          body: "Who is this?",
        });
        if (!turn.lrHandled) bookingCertFail("who-is-this", "BROKEN", "not handled");
        if (turn.lrReply.length > 320) {
          bookingCertFail("who-is-this", "RESPONSE_FAILURE", "reply too long for SMS");
        }
      },
    },
    {
      id: "accidental-call",
      group: "CONVERSATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550603");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550603",
          body: "Sorry, pocket dial.",
        });
        if (/book|pay|deposit/i.test(turn.lrReply)) {
          bookingCertFail("accidental-call", "POLICY_FAILURE", "aggressive recovery");
        }
      },
    },
    {
      id: "long-tail-messy",
      group: "CONVERSATION",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550604");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550604",
          body: "yeah",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550604",
          body: "tomorrow",
        });
        if (!turn.lrHandled) bookingCertFail("long-tail-messy", "BROKEN", "lost context");
      },
    },
  ];
}
