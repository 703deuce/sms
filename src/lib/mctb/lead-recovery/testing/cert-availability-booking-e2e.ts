import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { intentPermitsAiBook } from "@/lib/mctb/lead-recovery/booking-semantics";
import { evaluateLeadRecoveryPolicy } from "@/lib/mctb/lead-recovery/policy-engine";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { bookingCertFail, type CertScenario } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
  LR_E2E_WORKSPACE_ID,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import {
  getRecordingBookingLedger,
} from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";

function ledgerCounts() {
  const ledger = getRecordingBookingLedger();
  return {
    finds: ledger.filter((c) => c.kind === "find_slots").length,
    creates: ledger.filter((c) => c.kind === "create_booking").length,
  };
}

/** Deterministic policy boundary — no LLM. */
async function assertAvailabilityPolicyPermitsAiBook(id: string) {
  const config = await loadLeadRecoveryConfig(LR_E2E_WORKSPACE_ID);
  const intent = {
    primary_intent: "AVAILABILITY_QUESTION" as const,
    secondary_intents: [],
    lead_type: "NEW" as const,
    urgency: "NORMAL" as const,
    service_category: null,
    reason_for_contact: null,
    location: { raw: null, resolved: null },
    requested_time: "tomorrow",
    booking_requested: false,
    booking_disposition: "CHECK_AVAILABILITY" as const,
    callback_requested: false,
    payment_intent: false,
    complaint: false,
    human_requested: false,
    human_required: false,
    needs_clarification: false,
    extracted_entities: {},
    semantic_missing_information: [],
    language: "en",
    confidence: 0.9,
    missing_required_fields: [],
    workflow_updates: [],
  };
  if (!intentPermitsAiBook(intent)) {
    bookingCertFail(id, "POLICY_FAILURE", "CHECK_AVAILABILITY must permit AI scheduling workflow");
  }
  const policy = evaluateLeadRecoveryPolicy({
    workspace: config,
    intent,
    collectedData: {},
    conversationState: {
      conversationId: "policy-test",
      workspaceId: LR_E2E_WORKSPACE_ID,
      currentIntent: null,
      secondaryIntents: [],
      leadType: "UNKNOWN",
      urgency: "NORMAL",
      serviceCategory: null,
      collectedFields: {},
      missingFields: [],
      qualification: null,
      activeSpecialist: null,
      phase: "IDLE",
      clarificationAttempts: 0,
      lastIntent: null,
      intentPlan: { pendingIntents: [], completedIntents: [], blockedIntents: [], currentIntent: null },
      updatedAt: new Date().toISOString(),
    },
  });
  if (!policy.nextActions.some((a) => a.action === "AI_BOOK")) {
    bookingCertFail(id, "POLICY_FAILURE", "AVAILABILITY_QUESTION policy missing AI_BOOK");
  }
}

export function buildAvailabilityBookingE2eScenarios(): CertScenario[] {
  return [
    {
      id: "avail-policy-boundary",
      group: "AI_BOOKING",
      run: async () => {
        await configureE2eAiBookingPolicy();
        await assertAvailabilityPolicyPermitsAiBook("avail-policy-boundary");
      },
    },
    {
      id: "avail-anything-tomorrow-read",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550301");
        const intent = await runLeadRecoveryIntentAgent({
          message: "Anything tomorrow?",
          workspaceId: LR_E2E_WORKSPACE_ID,
          conversationId,
        });
        if (intent.primary_intent !== "AVAILABILITY_QUESTION") {
          bookingCertFail(
            "avail-anything-tomorrow-read",
            "MODEL_SEMANTIC_FAILURE",
            `intent ${intent.primary_intent}`,
          );
        }
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550301",
          body: "Anything tomorrow?",
        });
        const { finds, creates } = ledgerCounts();
        if (finds < 1) {
          bookingCertFail("avail-anything-tomorrow-read", "WORKFLOW_STATE_FAILURE", `finds ${finds}`);
        }
        if (creates !== 0) {
          bookingCertFail("avail-anything-tomorrow-read", "COMPLIANCE_FAILURE", `creates ${creates}`);
        }
      },
    },
    {
      id: "avail-after-two-read",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550302");
        const intent = await runLeadRecoveryIntentAgent({
          message: "Anything tomorrow after 2?",
          workspaceId: LR_E2E_WORKSPACE_ID,
          conversationId,
        });
        if (intent.primary_intent !== "AVAILABILITY_QUESTION") {
          bookingCertFail("avail-after-two-read", "MODEL_SEMANTIC_FAILURE", `intent ${intent.primary_intent}`);
        }
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550302",
          body: "Anything tomorrow after 2?",
        });
        const { finds, creates } = ledgerCounts();
        const offered = (await getMctbAiBookingSessionStore().get(conversationId))?.offeredSlots ?? [];
        const ids = new Set(offered.map((s) => s.slotId));
        if (finds < 1) {
          bookingCertFail("avail-after-two-read", "WORKFLOW_STATE_FAILURE", `finds ${finds}`);
        }
        if (creates !== 0) {
          bookingCertFail("avail-after-two-read", "COMPLIANCE_FAILURE", `creates ${creates}`);
        }
        if (!ids.has("cert-slot-3pm") || !ids.has("cert-slot-430pm")) {
          bookingCertFail(
            "avail-after-two-read",
            "SLOT_RESOLUTION_FAILURE",
            `afternoon slots missing: ${[...ids].join()}`,
          );
        }
      },
    },
    {
      id: "avail-specific-time-read",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550303");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550303",
          body: "Do you have 3 tomorrow?",
        });
        const { finds, creates } = ledgerCounts();
        if (finds < 1) {
          bookingCertFail("avail-specific-time-read", "WORKFLOW_STATE_FAILURE", `finds ${finds}`);
        }
        if (creates !== 0) {
          bookingCertFail("avail-specific-time-read", "COMPLIANCE_FAILURE", `creates ${creates}`);
        }
      },
    },
    {
      id: "avail-booking-request-no-write",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550304");
        const intent = await runLeadRecoveryIntentAgent({
          message: "I need somebody tomorrow.",
          workspaceId: LR_E2E_WORKSPACE_ID,
          conversationId,
        });
        if (intent.primary_intent !== "BOOKING_REQUEST") {
          bookingCertFail("avail-booking-request-no-write", "MODEL_SEMANTIC_FAILURE", `intent ${intent.primary_intent}`);
        }
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550304",
          body: "I need somebody tomorrow.",
        });
        const { creates } = ledgerCounts();
        if (creates !== 0) {
          bookingCertFail("avail-booking-request-no-write", "COMPLIANCE_FAILURE", `creates ${creates}`);
        }
      },
    },
    {
      id: "avail-then-select-confirm",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550305");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550305",
          body: "Anything tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550305",
          body: "3 works",
        });
        const { creates } = ledgerCounts();
        if (creates !== 1) {
          bookingCertFail("avail-then-select-confirm", "PROVIDER_FAILURE", `creates ${creates}`);
        }
        const ledger = getRecordingBookingLedger().filter((c) => c.kind === "create_booking");
        if (ledger[0]?.slotId !== "cert-slot-3pm") {
          bookingCertFail("avail-then-select-confirm", "SLOT_RESOLUTION_FAILURE", ledger[0]?.slotId || "none");
        }
      },
    },
    {
      id: "avail-then-reject-slots",
      group: "AI_BOOKING",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550306");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550306",
          body: "Anything tomorrow?",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550306",
          body: "None of those work.",
        });
        const { creates } = ledgerCounts();
        if (creates !== 0) {
          bookingCertFail("avail-then-reject-slots", "COMPLIANCE_FAILURE", `creates ${creates}`);
        }
      },
    },
  ];
}
