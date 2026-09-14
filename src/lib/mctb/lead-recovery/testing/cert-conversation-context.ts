import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import {
  buildMctbSemanticConversationContext,
  type MctbSemanticConversationContext,
} from "@/lib/mctb/semantic-conversation-context";
import { loadLeadRecoveryState, saveLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import { bookingCertFail, type CertScenario } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import { LR_E2E_WORKSPACE_ID } from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { createE2eConversation, resetE2eRecordingState } from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";

async function seedThread(
  conversationId: string,
  thread: Array<{ role: "customer" | "business"; text: string }>,
  statePatch?: Partial<Awaited<ReturnType<typeof loadLeadRecoveryState>>>,
) {
  const state = await loadLeadRecoveryState({
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
  });
  await saveLeadRecoveryState({ ...state, conversationThread: thread, ...statePatch });
}

async function ctxFor(
  conversationId: string,
  latest: string,
): Promise<MctbSemanticConversationContext> {
  return buildMctbSemanticConversationContext({
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
    latestCustomerMessage: latest,
  });
}

export function buildConversationContextScenarios(): CertScenario[] {
  return [
    {
      id: "ctx-yeah-schedule",
      group: "CONVERSATION_CONTEXT",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId } = await createE2eConversation("+15555550801");
        await seedThread(conversationId, [
          { role: "business", text: "Would you like to schedule service?" },
        ]);
        const intent = await runLeadRecoveryIntentAgent({
          message: "yeah",
          workspaceId: LR_E2E_WORKSPACE_ID,
          conversationId,
        });
        if (
          intent.primary_intent !== "BOOKING_REQUEST" &&
          intent.booking_requested !== true &&
          !intent.secondary_intents.includes("BOOKING_REQUEST")
        ) {
          bookingCertFail("ctx-yeah-schedule", "MODEL_SEMANTIC_FAILURE", `intent ${intent.primary_intent}`);
        }
      },
    },
    {
      id: "ctx-second-slot",
      group: "CONVERSATION_CONTEXT",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId } = await createE2eConversation("+15555550802");
        await seedThread(conversationId, [
          { role: "business", text: "Tomorrow I have 10 AM, 1 PM, or 3 PM. Which works?" },
        ]);
        const semanticCtx = await ctxFor(conversationId, "the second one");
        const spec = await runSchedulingSpecialistAgent({
          message: "the second one",
          timezone: "America/New_York",
          nowIso: "2026-09-13T12:00:00.000Z",
          offeredSlots: [
            {
              slotId: "a",
              startUtc: "2026-09-14T14:00:00.000Z",
              endUtc: "2026-09-14T15:00:00.000Z",
              timezone: "America/New_York",
              label: "10 AM",
            },
            {
              slotId: "b",
              startUtc: "2026-09-14T17:00:00.000Z",
              endUtc: "2026-09-14T18:00:00.000Z",
              timezone: "America/New_York",
              label: "1 PM",
            },
            {
              slotId: "c",
              startUtc: "2026-09-14T19:00:00.000Z",
              endUtc: "2026-09-14T20:00:00.000Z",
              timezone: "America/New_York",
              label: "3 PM",
            },
          ],
          aiBookingSessionActive: true,
          sessionStage: "AWAITING_SLOT_SELECTION",
          semanticContext: semanticCtx,
        });
        if (spec.offered_slot_index !== 2 && spec.offered_slot_id !== "b") {
          bookingCertFail(
            "ctx-second-slot",
            "MODEL_SEMANTIC_FAILURE",
            `slot ${spec.offered_slot_index} id ${spec.offered_slot_id}`,
          );
        }
      },
    },
    {
      id: "ctx-do-not-cancel",
      group: "CONVERSATION_CONTEXT",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId } = await createE2eConversation("+15555550803");
        await seedThread(
          conversationId,
          [
            { role: "business", text: "Should I cancel the appointment?" },
          ],
          {
            phase: "AWAITING_SLOT_SELECTION",
            pendingAction: { action: "AI_BOOK", epoch: 1 },
          },
        );
        const intent = await runLeadRecoveryIntentAgent({
          message: "no",
          workspaceId: LR_E2E_WORKSPACE_ID,
          conversationId,
        });
        const cancelAll = intent.workflow_updates?.some(
          (w) => w.instruction === "CANCEL" && w.target === "ALL_PENDING",
        );
        if (cancelAll || intent.primary_intent === "CANCEL_REQUEST") {
          bookingCertFail("ctx-do-not-cancel", "MODEL_SEMANTIC_FAILURE", "treated no as cancel");
        }
      },
    },
    {
      id: "ctx-long-thread-corrections",
      group: "CONVERSATION_CONTEXT",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId } = await createE2eConversation("+15555550804");
        const thread: Array<{ role: "customer" | "business"; text: string }> = [
          { role: "customer", text: "Need HVAC service" },
          { role: "business", text: "Happy to help — what's the address?" },
          { role: "customer", text: "123 Main St" },
          { role: "business", text: "Thanks. When works for you?" },
          { role: "customer", text: "Friday at 3" },
          { role: "business", text: "I can offer Friday 10 AM, 1 PM, or 3 PM." },
          { role: "customer", text: "Sorry, 132 Main St" },
          { role: "business", text: "Updated to 132 Main St. Still want Friday 3 PM?" },
          { role: "customer", text: "Actually Saturday after 2" },
          { role: "business", text: "Saturday I have 10 AM, 1 PM, 3 PM, or 4:30 PM after 2." },
          { role: "customer", text: "hmm" },
          { role: "business", text: "Which of those Saturday times should I hold?" },
          { role: "customer", text: "yeah, the second one" },
        ];
        await seedThread(conversationId, thread, {
          phase: "AWAITING_SLOT_SELECTION",
          collectedFields: { ADDRESS: "132 Main St" },
        });
        const semanticCtx = await ctxFor(conversationId, "yeah, the second one");
        if (semanticCtx.context_truncated) {
          bookingCertFail("ctx-long-thread-corrections", "CONTEXT_FAILURE", "thread truncated");
        }
        if (semanticCtx.context_message_count < 12) {
          bookingCertFail(
            "ctx-long-thread-corrections",
            "CONTEXT_FAILURE",
            `messages ${semanticCtx.context_message_count} expected >= 12`,
          );
        }
        const spec = await runSchedulingSpecialistAgent({
          message: "yeah, the second one",
          timezone: "America/New_York",
          nowIso: "2026-09-13T12:00:00.000Z",
          offeredSlots: [
            {
              slotId: "sat-10",
              startUtc: "2026-09-19T14:00:00.000Z",
              endUtc: "2026-09-19T15:00:00.000Z",
              timezone: "America/New_York",
              label: "Saturday 10 AM",
            },
            {
              slotId: "sat-1",
              startUtc: "2026-09-19T17:00:00.000Z",
              endUtc: "2026-09-19T18:00:00.000Z",
              timezone: "America/New_York",
              label: "Saturday 1 PM",
            },
            {
              slotId: "sat-3",
              startUtc: "2026-09-19T19:00:00.000Z",
              endUtc: "2026-09-19T20:00:00.000Z",
              timezone: "America/New_York",
              label: "Saturday 3 PM",
            },
          ],
          aiBookingSessionActive: true,
          sessionStage: "AWAITING_SLOT_SELECTION",
          semanticContext: semanticCtx,
        });
        if (spec.offered_slot_index !== 2 && spec.offered_slot_id !== "sat-1") {
          bookingCertFail(
            "ctx-long-thread-corrections",
            "MODEL_SEMANTIC_FAILURE",
            `slot index ${spec.offered_slot_index} id ${spec.offered_slot_id}`,
          );
        }
        const intent = await runLeadRecoveryIntentAgent({
          message: "yeah, the second one",
          workspaceId: LR_E2E_WORKSPACE_ID,
          conversationId,
        });
        const addr =
          intent.extracted_entities?.ADDRESS ||
          intent.extracted_entities?.address ||
          semanticCtx.structured_state.collected_fields.ADDRESS;
        if (addr && String(addr).includes("123 Main") && !String(addr).includes("132")) {
          bookingCertFail("ctx-long-thread-corrections", "MODEL_SEMANTIC_FAILURE", "stale address");
        }
      },
    },
  ];
}
