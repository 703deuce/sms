import { AgentSessionEventTypes, type AgentSession } from "@livekit/agents";
import { parseToolFeedbackFromModel, formatToolFeedbackForModel, toolFeedbackRecoverable } from "@/lib/voice/tool-feedback";
import type { FrontDeskUserData } from "../userdata";
import { isBookingConfirmed } from "../userdata";
import { waitForFrontDeskGoodbyePlayout } from "../end-frontdesk-call";
import {
  activateBookingWorkflow,
  activateMessageWorkflow,
  bookingFieldsComplete,
  bookingToolsActivateIntent,
  ensureReceptionistWorkflow,
  messageFieldsComplete,
  setWorkflowState,
  transitionAfterRecordField,
  transitionFromToolFeedback,
} from "./workflow-engine";
import { allowedToolNamesForWorkflow, workflowBlockedGuidance } from "./workflow-tool-surface";
import { askNextCollectionField, beginDeterministicFieldCollection } from "./deterministic-field-collection";

function logOrchestrator(callId: string, event: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "receptionist-workflow-orchestrator",
      event,
      callId,
      ...extra,
    }),
  );
}

export async function syncReceptionistToolSurface(
  session: AgentSession<FrontDeskUserData>,
): Promise<void> {
  await syncAgentToolSurface(session);
}

async function runtimeFinalizeBookingFailure(
  session: AgentSession<FrontDeskUserData>,
  guidance: string,
): Promise<void> {
  const ud = session.userData;
  setWorkflowState(ud, "BOOKING_FAILED", { requiredTool: "list_available_slots" });
  await syncAgentToolSurface(session);
  await session.generateReply({
    instructions:
      `Booking did not complete. The caller already heard: ${guidance}. ` +
      "Do NOT say the appointment is booked or that they are all set. " +
      "Offer to check other times or take a message.",
    toolChoice: "none",
  });
}

async function syncAgentToolSurface(session: AgentSession<FrontDeskUserData>): Promise<void> {
  const ud = session.userData;
  const allNames = ud.receptionistToolNames || [];
  const allowed = allowedToolNamesForWorkflow(ud, allNames);
  const agent = session.currentAgent as { updateTools?: (tools: unknown[]) => Promise<void> } | null;
  if (!agent?.updateTools || !ud.receptionistToolDefs?.length) return;

  const filtered = ud.receptionistToolDefs.filter((tool) => {
    const name =
      tool && typeof tool === "object" && "name" in tool
        ? String((tool as { name?: string }).name || "")
        : "";
    return name && allowed.has(name);
  });

  try {
    await agent.updateTools(filtered as never);
    logOrchestrator(ud.callId, "tool_surface_synced", {
      state: ud.receptionistWorkflow?.state,
      allowed: [...allowed],
      exposed: filtered.length,
    });
  } catch (err) {
    logOrchestrator(ud.callId, "tool_surface_sync_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runtimeListAvailableSlots(session: AgentSession<FrontDeskUserData>): Promise<void> {
  const ud = session.userData;
  setWorkflowState(ud, "BOOKING_CHECK_AVAILABILITY");
  await syncAgentToolSurface(session);

  const cal = ud.cal;
  try {
    const slots = await cal.listAvailableSlots({ daysAhead: 14 });
    const slotsMap = ud.receptionistSlotsMap;
    if (slotsMap) {
      slotsMap.clear();
      for (const slot of slots) {
        slotsMap.set(slot.slotId, slot);
      }
    }
    const lines = cal.formatSlotsForModel(slots);
    const wf = ensureReceptionistWorkflow(ud);
    wf.offeredSlotIds = slots.map((s) => s.slotId);
    setWorkflowState(ud, "BOOKING_OFFER_SLOTS", { offeredSlotIds: wf.offeredSlotIds });

    const slotText = lines || "No appointment slots are available right now.";
    const instructions =
      slots.length > 0
        ? `Read these available times and offer up to three options naturally. Ask exactly one question: which time works?\n${slotText}`
        : `Tell the caller briefly that there are no openings right now. Offer to take a message or check another day.\n${slotText}`;

    await session.generateReply({ instructions, toolChoice: "none" });
    await syncAgentToolSurface(session);
    logOrchestrator(ud.callId, "availability_offered", { slotCount: slots.length });
  } catch (err) {
    logOrchestrator(ud.callId, "availability_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    await session.generateReply({
      instructions:
        "Apologize briefly — the calendar is not responding. Offer to take a message so staff can call back.",
      toolChoice: "none",
    });
  }
}

async function runtimeFinalizeTerminalSuccess(session: AgentSession<FrontDeskUserData>): Promise<void> {
  const ud = session.userData;
  if (ud.callClosing) return;
  const wf = ensureReceptionistWorkflow(ud);
  wf.speechLocked = true;
  ud.callClosing = true;
  setWorkflowState(ud, "END", { speechLocked: true, requiredTool: "end_call" });
  await syncAgentToolSurface(session);
  await waitForFrontDeskGoodbyePlayout(session);
  logOrchestrator(ud.callId, "terminal_success_shutdown");
  session.shutdown({ reason: "workflow_terminal_success" });
}

async function runProactiveWorkflowStep(session: AgentSession<FrontDeskUserData>): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);

  switch (wf.state) {
    case "BOOKING_CHECK_AVAILABILITY":
      await runtimeListAvailableSlots(session);
      return;
    case "BOOKING_DONE":
      if (isBookingConfirmed(ud) && wf.speechLocked) {
        await runtimeFinalizeTerminalSuccess(session);
      }
      return;
    case "MESSAGE_COMMIT":
      if (messageFieldsComplete(ud) && !ud.receptionistMessageTaken) {
        wf.requiredTool = "take_message";
        await session.generateReply({
          instructions:
            "Required callback details are complete. Call take_message now with the reason from the conversation. " +
            "Do not ask for information already collected.",
          toolChoice: "required",
        });
      }
      return;
    default:
      return;
  }
}

export async function prepareWorkflowForTool(
  session: AgentSession<FrontDeskUserData>,
  toolName: string,
): Promise<void> {
  const ud = session.userData;
  const intent = bookingToolsActivateIntent(toolName);
  if (intent === "booking") {
    activateBookingWorkflow(ud);
    if (
      (toolName === "list_available_slots" || toolName === "schedule_appointment") &&
      !bookingFieldsComplete(ud)
    ) {
      await beginDeterministicFieldCollection(session, "booking", { skipFirstQuestion: true });
      await syncAgentToolSurface(session);
      await askNextCollectionField(session, "booking");
      const { forceRecordCurrentFieldTurn } = await import("./deterministic-field-collection");
      await forceRecordCurrentFieldTurn(session);
      return;
    }
    if (toolName === "schedule_appointment" && ud.pendingSlotId) {
      setWorkflowState(ud, "BOOKING_COMMIT", { requiredTool: "schedule_appointment" });
    }
  }
  if (intent === "message") {
    activateMessageWorkflow(ud);
    if (!messageFieldsComplete(ud)) {
      await beginDeterministicFieldCollection(session, "message", { skipFirstQuestion: true });
      await syncAgentToolSurface(session);
      await askNextCollectionField(session, "message");
      const { forceRecordCurrentFieldTurn } = await import("./deterministic-field-collection");
      await forceRecordCurrentFieldTurn(session);
    } else {
      setWorkflowState(ud, "MESSAGE_COMMIT", { requiredTool: "take_message" });
    }
  }
  if (intent === "transfer") {
    setWorkflowState(ud, "TRANSFER_PREPARE", { requiredTool: "transfer_to_human" });
    await syncAgentToolSurface(session);
  }
  if (intent === "faq") {
    setWorkflowState(ud, "FAQ");
    await syncAgentToolSurface(session);
  }
}

export async function afterReceptionistToolExecuted(
  session: AgentSession<FrontDeskUserData>,
  toolName: string,
  rawResult: string,
): Promise<void> {
  const ud = session.userData;
  const feedback = parseToolFeedbackFromModel(rawResult);
  if (!feedback) return;

  if (toolName === "record_current_field" && feedback.outcome === "success") {
    const purpose = ud.receptionistWorkflow?.collectionPurpose || "booking";
    transitionAfterRecordField(ud, purpose);
    const wf = ensureReceptionistWorkflow(ud);
    if (wf.state === "BOOKING_CHECK_AVAILABILITY") {
      await syncAgentToolSurface(session);
      await runProactiveWorkflowStep(session);
      return;
    }
    if (wf.state === "MESSAGE_COMMIT") {
      await syncAgentToolSurface(session);
      await runProactiveWorkflowStep(session);
      return;
    }
    if (wf.state === "BOOKING_COLLECT" || wf.state === "MESSAGE_COLLECT") {
      const asked = await askNextCollectionField(
        session,
        purpose,
        feedback.field_id,
        typeof feedback.context?.saved_value === "string" ? feedback.context.saved_value : undefined,
      );
      if (asked) {
        const { forceRecordCurrentFieldTurn } = await import("./deterministic-field-collection");
        await forceRecordCurrentFieldTurn(session);
      }
      if (!asked) {
        transitionAfterRecordField(ud, purpose);
        await syncAgentToolSurface(session);
        await runProactiveWorkflowStep(session);
      }
      return;
    }
  }

  if (toolName === "take_message" && feedback.outcome === "success") {
    setWorkflowState(ud, "MESSAGE_DONE", { speechLocked: false, requiredTool: "end_call" });
  }

  if (toolName === "schedule_appointment" && feedback.outcome === "success") {
    const wf = transitionFromToolFeedback(ud, toolName, feedback);
    wf.speechLocked = true;
    wf.state = "BOOKING_DONE";
    wf.requiredTool = "end_call";
    await syncAgentToolSurface(session);
    if (feedback.caller_already_heard_success) {
      await runProactiveWorkflowStep(session);
    }
    return;
  }

  if (
    toolName === "schedule_appointment" &&
    feedback.outcome === "recoverable_failure" &&
    feedback.caller_already_heard_failure
  ) {
    transitionFromToolFeedback(ud, toolName, feedback);
    await runtimeFinalizeBookingFailure(session, feedback.guidance);
    return;
  }

  if (toolName === "list_available_slots" && feedback.outcome === "success") {
    transitionFromToolFeedback(ud, toolName, feedback);
    await syncAgentToolSurface(session);
    if (feedback.next_action === "offer_slots_and_confirm") {
      setWorkflowState(ud, "BOOKING_OFFER_SLOTS", { requiredTool: "schedule_appointment" });
      await syncAgentToolSurface(session);
    }
    return;
  }

  transitionFromToolFeedback(ud, toolName, feedback);
  await syncAgentToolSurface(session);
  await runProactiveWorkflowStep(session);
}

export function workflowToolBlockedResult(ud: FrontDeskUserData, toolName: string): string {
  return formatToolFeedbackForModel(
    toolFeedbackRecoverable({
      tool: toolName,
      recovery_class: "OPERATION_IN_PROGRESS",
      reason: "workflow_blocked",
      next_action:
        ud.receptionistWorkflow?.requiredTool === "record_current_field"
          ? "collect_field_then_retry"
          : "continue_conversation",
      runtime_handled_retry: true,
      guidance: workflowBlockedGuidance(ud, toolName),
    }),
  );
}

export function attachReceptionistWorkflowOrchestrator(
  session: AgentSession<FrontDeskUserData>,
): void {
  const ud = session.userData;
  ensureReceptionistWorkflow(ud);
  void syncReceptionistToolSurface(session);

  session.on(AgentSessionEventTypes.FunctionToolsExecuted, async (ev) => {
    for (let i = 0; i < ev.functionCalls.length; i++) {
      const call = ev.functionCalls[i];
      const output = ev.functionCallOutputs[i];
      if (!output?.output) continue;
      try {
        await afterReceptionistToolExecuted(session, call.name, String(output.output));
      } catch (err) {
        logOrchestrator(ud.callId, "orchestrator_error", {
          tool: call.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}
