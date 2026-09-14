import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { createBooking } from "@/lib/mctb/ai-booking/service";
import { assertNoFalseSuccess } from "@/lib/mctb/lead-recovery/testing/cert-e2e-false-success";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import {
  CERT_DEFAULT_SLOTS,
  getRecordingBookingLedger,
  setRecordingBookingBehavior,
  setRecordingBookingCreateDelay,
  setRecordingBookingRevalidateOmitsSlot,
  setRecordingBookingSlots,
} from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
export type CertScenario = {
  id: string;
  group: string;
  run: () => Promise<void>;
};

export function bookingCertFail(id: string, cls: string, detail: string): never {
  throw Object.assign(new Error(detail), { scenarioId: id, failureClass: cls });
}

async function offeredSlots(conversationId: string) {
  const session = await getMctbAiBookingSessionStore().get(conversationId);
  return session?.offeredSlots ?? [];
}

export function buildAiBookingE2eScenarios(): CertScenario[] {
  return [
    {
      id: "booking-basic-availability",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        setRecordingBookingSlots(CERT_DEFAULT_SLOTS.slice(0, 3));
        const { conversationId, contactId } = await createE2eConversation("+15555550201");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550201",
          body: "Can somebody come tomorrow?",
        });
        const offered = await offeredSlots(conversationId);
        const ids = offered.map((s) => s.slotId).sort();
        const expected = ["cert-slot-10am", "cert-slot-1pm", "cert-slot-3pm"].sort();
        if (ids.join() !== expected.join()) {
          bookingCertFail(
            "booking-basic-availability",
            "PROVIDER_FAILURE",
            `offered slots ${ids.join()} expected ${expected.join()}`,
          );
        }
        if (getRecordingBookingLedger().filter((c) => c.kind === "create_booking").length !== 0) {
          bookingCertFail("booking-basic-availability", "COMPLIANCE_FAILURE", "premature booking create");
        }
      },
    },
    {
      id: "booking-after-two",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550202");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550202",
          body: "Anything tomorrow after 2?",
        });
        const offered = await offeredSlots(conversationId);
        const ids = new Set(offered.map((s) => s.slotId));
        if (!ids.has("cert-slot-3pm") || !ids.has("cert-slot-430pm")) {
          bookingCertFail(
            "booking-after-two",
            "PROVIDER_FAILURE",
            `filtered slots missing afternoon options: ${[...ids].join()}`,
          );
        }
        if (ids.has("cert-slot-10am") || ids.has("cert-slot-1pm")) {
          bookingCertFail(
            "booking-after-two",
            "PROVIDER_FAILURE",
            `morning slots should be excluded: ${[...ids].join()}`,
          );
        }
      },
    },
    {
      id: "booking-second-one",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550203");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550203",
          body: "Anything tomorrow after 2?",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550203",
          body: "the second one",
        });
        const offered = await offeredSlots(conversationId);
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length === 1 && creates[0].slotId !== "cert-slot-430pm") {
          bookingCertFail(
            "booking-second-one",
            "PROVIDER_FAILURE",
            `create slot ${creates[0].slotId} not cert-slot-430pm`,
          );
        }
        if (creates.length === 1) {
          const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: true });
          if (fs.length) bookingCertFail("booking-second-one", "COMPLIANCE_FAILURE", fs.join("; "));
        }
      },
    },
    {
      id: "booking-explicit-three",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550204");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550204",
          body: "Can somebody come tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550204",
          body: "3 PM works",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length !== 1 || creates[0].slotId !== "cert-slot-3pm") {
          bookingCertFail(
            "booking-explicit-three",
            "PROVIDER_FAILURE",
            `expected create cert-slot-3pm got ${creates.map((c) => c.slotId).join()}`,
          );
        }
      },
    },
    {
      id: "booking-success-once",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550205");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550205",
          body: "Can somebody come tomorrow?",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550205",
          body: "3 PM works",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length !== 1) {
          bookingCertFail("booking-success-once", "PROVIDER_FAILURE", `creates ${creates.length}`);
        }
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: true });
        if (fs.length) bookingCertFail("booking-success-once", "COMPLIANCE_FAILURE", fs.join("; "));
        if (!/booked|confirmed/i.test(turn.lrReply)) {
          bookingCertFail("booking-success-once", "COMPLIANCE_FAILURE", "missing booking confirmation reply");
        }
      },
    },
    {
      id: "booking-slot-disappears",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        setRecordingBookingRevalidateOmitsSlot("cert-slot-3pm");
        const { conversationId, contactId } = await createE2eConversation("+15555550206");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550206",
          body: "Can somebody come tomorrow?",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550206",
          body: "3 PM works",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length !== 0) {
          bookingCertFail("booking-slot-disappears", "PROVIDER_FAILURE", "booking write when slot gone");
        }
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: false });
        if (fs.length) bookingCertFail("booking-slot-disappears", "COMPLIANCE_FAILURE", fs.join("; "));
      },
    },
    {
      id: "booking-provider-disconnected",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        setRecordingBookingBehavior("disconnected");
        const { conversationId, contactId } = await createE2eConversation("+15555550207");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550207",
          body: "Can somebody come tomorrow?",
        });
        if (getRecordingBookingLedger().some((c) => c.kind === "create_booking")) {
          bookingCertFail("booking-provider-disconnected", "PROVIDER_FAILURE", "booking write");
        }
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: false });
        if (fs.length) bookingCertFail("booking-provider-disconnected", "COMPLIANCE_FAILURE", fs.join("; "));
      },
    },
    {
      id: "booking-provider-timeout",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        setRecordingBookingBehavior("timeout");
        const { conversationId, contactId } = await createE2eConversation("+15555550208");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550208",
          body: "Can somebody come tomorrow?",
        });
        if (getRecordingBookingLedger().some((c) => c.kind === "create_booking")) {
          bookingCertFail("booking-provider-timeout", "PROVIDER_FAILURE", "booking write on timeout");
        }
        if (!turn.lrReply.trim()) {
          bookingCertFail("booking-provider-timeout", "RESPONSE_FAILURE", "empty reply");
        }
      },
    },
    {
      id: "booking-create-failure",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        setRecordingBookingBehavior("permanent_failure");
        const { conversationId, contactId } = await createE2eConversation("+15555550209");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550209",
          body: "Can somebody come tomorrow?",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550209",
          body: "3 PM works",
        });
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: false });
        if (fs.length) bookingCertFail("booking-create-failure", "COMPLIANCE_FAILURE", fs.join("; "));
      },
    },
    {
      id: "booking-change-mind-10x",
      group: "AI_BOOKING",
      run: async () => {
        for (let i = 0; i < 10; i++) {
          resetE2eRecordingState();
          await configureE2eAiBookingPolicy();
          const phone = `+1555555021${i}`;
          const { conversationId, contactId } = await createE2eConversation(phone);
          await runLeadRecoveryCustomerTurn({
            conversationId,
            contactId,
            customerPhone: phone,
            body: "Can somebody come tomorrow?",
          });
          await runLeadRecoveryCustomerTurn({
            conversationId,
            contactId,
            customerPhone: phone,
            body: "3 PM",
          });
          await runLeadRecoveryCustomerTurn({
            conversationId,
            contactId,
            customerPhone: phone,
            body: "Actually never mind.",
          });
          const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
          if (creates.length !== 0) {
            bookingCertFail("booking-change-mind-10x", "CONCURRENCY_FAILURE", `iter ${i} creates ${creates.length}`);
          }
        }
      },
    },
    {
      id: "booking-correction",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550220");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550220",
          body: "Anything tomorrow after 2?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550220",
          body: "3 PM",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550220",
          body: "Sorry, 4:30 works",
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        const three = creates.filter((c) => c.slotId === "cert-slot-3pm");
        if (three.length !== 0) {
          bookingCertFail("booking-correction", "PROVIDER_FAILURE", "3pm booking should be 0");
        }
        const last = creates.at(-1);
        if (last && last.slotId !== "cert-slot-430pm") {
          bookingCertFail("booking-correction", "PROVIDER_FAILURE", `final slot ${last.slotId}`);
        }
      },
    },
    {
      id: "booking-duplicate-confirm",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550221");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550221",
          body: "Can somebody come tomorrow?",
        });
        const pid = "booking-dup-confirm-1";
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550221",
          body: "3 PM works",
          providerMessageId: pid,
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550221",
          body: "3 PM works",
          providerMessageId: pid,
        });
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length > 1) {
          bookingCertFail("booking-duplicate-confirm", "CONCURRENCY_FAILURE", `creates ${creates.length}`);
        }
      },
    },
    {
      id: "booking-cancel-after-success",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550222");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550222",
          body: "Can somebody come tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550222",
          body: "3 PM works",
        });
        const before = getRecordingBookingLedger().filter((c) => c.kind === "create_booking").length;
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550222",
          body: "Never mind.",
        });
        const after = getRecordingBookingLedger().filter((c) => c.kind === "create_booking").length;
        if (after < before) {
          bookingCertFail("booking-cancel-after-success", "BROKEN", "booking history erased");
        }
      },
    },
    {
      id: "booking-stale-epoch-gate",
      group: "PROVIDER_WRITE_GATE",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550223");
        const ws = (await import("@/lib/mctb/lead-recovery/testing/cert-e2e-harness")).LR_E2E_WORKSPACE_ID;
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550223",
          body: "Can somebody come tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550223",
          body: "Never mind",
        });
        const stale = await createBooking({
          workspaceId: ws,
          conversationId,
          slotId: "cert-slot-3pm",
          customerName: "Cert",
          writeEpoch: 1,
        });
        if (stale.ok) {
          bookingCertFail("booking-stale-epoch-gate", "CONCURRENCY_FAILURE", "stale epoch wrote booking");
        }
        const creates = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (creates.length !== 0) {
          bookingCertFail("booking-stale-epoch-gate", "PROVIDER_FAILURE", "provider create after cancel");
        }
      },
    },
    {
      id: "booking-create-timeout-behavior",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        setRecordingBookingCreateDelay(50);
        setRecordingBookingBehavior("create_timeout");
        const { conversationId, contactId } = await createE2eConversation("+15555550224");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550224",
          body: "Can somebody come tomorrow?",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550224",
          body: "3 PM works",
        });
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: false });
        if (fs.length) bookingCertFail("booking-create-timeout-behavior", "COMPLIANCE_FAILURE", fs.join("; "));
      },
    },
  ];
}
