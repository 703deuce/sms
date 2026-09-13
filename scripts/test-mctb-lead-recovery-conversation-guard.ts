import assert from "node:assert/strict";
import {
  invalidatePendingActions,
  registerInboundProviderMessage,
  shouldInvalidatePendingActions,
  withLeadRecoveryConversationLock,
} from "@/lib/mctb/lead-recovery/conversation-guard";

const state = {
  conversationId: "c1",
  workspaceId: "w1",
  currentIntent: null,
  secondaryIntents: [],
  leadType: "UNKNOWN" as const,
  urgency: "NORMAL" as const,
  serviceCategory: null,
  collectedFields: {},
  missingFields: [],
  qualification: null,
  activeSpecialist: null,
  activeAction: null,
  phase: "IDLE" as const,
  clarificationAttempts: 0,
  lastIntent: null,
  intentPlan: {
    pendingIntents: [],
    completedIntents: [],
    blockedIntents: [],
    currentIntent: null,
  },
  stateVersion: 0,
  pendingActionEpoch: 0,
  processedInboundIds: [],
  updatedAt: new Date().toISOString(),
};

const first = registerInboundProviderMessage(state, "sid-1");
const dup = registerInboundProviderMessage(first.state, "sid-1");
assert.equal(dup.duplicate, true);

assert.ok(
  shouldInvalidatePendingActions({
    intent: {
      primary_intent: "BOOKING_REQUEST",
      secondary_intents: [],
      lead_type: "NEW",
      urgency: "NORMAL",
      service_category: null,
      reason_for_contact: null,
      location: { raw: null, resolved: null },
      requested_time: null,
      booking_requested: true,
      callback_requested: false,
      payment_intent: false,
      complaint: false,
      human_required: false,
      language: "en",
      confidence: 0.9,
      missing_required_fields: [],
    },
    body: "never mind",
  }),
);

async function main() {
  let order = "";
  await withLeadRecoveryConversationLock("x", async () => {
    order += "1";
    await new Promise((r) => setTimeout(r, 10));
  });
  await withLeadRecoveryConversationLock("x", async () => {
    order += "2";
  });
  assert.equal(order, "12");
  console.log("test-mctb-lead-recovery-conversation-guard: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
