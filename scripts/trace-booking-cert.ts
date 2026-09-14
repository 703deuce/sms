#!/usr/bin/env npx tsx
import { setMctbAiBookingSessionStore, inMemoryMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { getRecordingBookingLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { buildMctbSemanticConversationContext } from "@/lib/mctb/semantic-conversation-context";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import { mapSpecialistToOrchestratorInput } from "@/lib/mctb/ai-booking/agents/map-to-orchestrator";
import { schedulingSpecialistContextExtras } from "@/lib/mctb/semantic-conversation-context";
import { LR_E2E_WORKSPACE_ID } from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { filterSlotsWithinWindow } from "@/lib/mctb/ai-booking/slot-presentation";
import { CERT_DEFAULT_SLOTS } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";

async function traceAfterTwo() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  resetE2eRecordingState();
  await configureE2eAiBookingPolicy();
  const body = "Anything tomorrow after 2?";
  const { conversationId, contactId } = await createE2eConversation("+15555559901");
  const turn = await runLeadRecoveryCustomerTurn({
    conversationId,
    contactId,
    customerPhone: "+15555559901",
    body,
  });
  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const semanticCtx = await buildMctbSemanticConversationContext({
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
    latestCustomerMessage: body,
  });
  const extras = await schedulingSpecialistContextExtras({
    workspaceId: LR_E2E_WORKSPACE_ID,
    timezone: "America/New_York",
  });
  const specialist = await runSchedulingSpecialistAgent({
    message: body,
    timezone: "America/New_York",
    nowIso: extras.nowIso,
    offeredSlots: [],
    aiBookingSessionActive: false,
    semanticContext: semanticCtx,
    bookingAuthorized: true,
  });
  const mapped = mapSpecialistToOrchestratorInput(
    specialist,
    {
      workspaceId: LR_E2E_WORKSPACE_ID,
      conversationId,
      customerName: "Cert",
      customerPhone: "+15555559901",
      timezone: "America/New_York",
      customerMessage: body,
    },
    { referenceUtcIso: extras.nowIso },
  );
  const before = CERT_DEFAULT_SLOTS;
  const after = mapped
    ? filterSlotsWithinWindow(before, mapped.windowStartUtc, mapped.windowEndUtc)
    : [];
  console.log(JSON.stringify({
    lrReply: turn.lrReply,
    conversation: semanticCtx.conversation,
    specialist,
    mapped,
    slotsBefore: before.map((s) => s.slotId),
    slotsAfter: after.map((s) => s.slotId),
    offered: session?.offeredSlots?.map((s) => s.slotId),
    ledger: getRecordingBookingLedger(),
  }, null, 2));
}

async function traceThreePm() {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  resetE2eRecordingState();
  await configureE2eAiBookingPolicy();
  const { conversationId, contactId } = await createE2eConversation("+15555559902");
  await runLeadRecoveryCustomerTurn({
    conversationId,
    contactId,
    customerPhone: "+15555559902",
    body: "Can somebody come tomorrow?",
  });
  const turn2 = await runLeadRecoveryCustomerTurn({
    conversationId,
    contactId,
    customerPhone: "+15555559902",
    body: "3 PM works",
  });
  console.log(JSON.stringify({
    turn2,
    creates: getRecordingBookingLedger().filter((c) => c.kind === "create_booking"),
    offered: (await getMctbAiBookingSessionStore().get(conversationId))?.offeredSlots?.map((s) => s.slotId),
  }, null, 2));
}

const which = process.argv[2] || "after-two";
if (which === "three-pm") traceThreePm().catch(console.error);
else traceAfterTwo().catch(console.error);
