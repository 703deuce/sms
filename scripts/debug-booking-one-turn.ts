#!/usr/bin/env npx tsx
import { setMctbAiBookingSessionStore, inMemoryMctbAiBookingSessionStore } from "../src/lib/mctb/ai-booking/session-store";
import { runSchedulingSpecialistAgent } from "../src/lib/mctb/ai-booking/agents/scheduling-specialist";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  ensureLeadRecoveryE2eWorkspace,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "../src/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { getRecordingBookingLedger } from "../src/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { getMctbAiBookingSessionStore } from "../src/lib/mctb/ai-booking/session-store";
import { runLeadRecoveryIntentAgent } from "../src/lib/mctb/lead-recovery/intent-agent";

async function main() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  await ensureLeadRecoveryE2eWorkspace();
  resetE2eRecordingState();
  await configureE2eAiBookingPolicy();

  const intent = await runLeadRecoveryIntentAgent({ message: "Can somebody come tomorrow?" });
  console.log("intent", intent.primary_intent, intent.confidence);

  const spec = await runSchedulingSpecialistAgent({
    message: "Can somebody come tomorrow?",
    timezone: "America/New_York",
    nowIso: "2026-09-13T12:00:00.000Z",
    offeredSlots: [],
    aiBookingSessionActive: false,
  });
  console.log("specialist", JSON.stringify(spec, null, 2));

  const { conversationId, contactId } = await createE2eConversation("+15559999001");
  const turn = await runLeadRecoveryCustomerTurn({
    conversationId,
    contactId,
    customerPhone: "+15559999001",
    body: "Can somebody come tomorrow?",
  });
  console.log("turn", turn.lrHandled, turn.lrAction, turn.lrReply?.slice(0, 160));
  console.log("ledger", getRecordingBookingLedger());
  const s = await getMctbAiBookingSessionStore().get(conversationId);
  console.log("slots", s?.offeredSlots?.map((x) => x.slotId));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
