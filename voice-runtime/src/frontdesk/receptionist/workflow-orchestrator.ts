import { AgentSessionEventTypes, type AgentSession } from "@livekit/agents";
import { parseToolFeedbackFromModel, formatToolFeedbackForModel, toolFeedbackRecoverable } from "@/lib/voice/tool-feedback";
import type { FrontDeskUserData } from "../userdata";
import { isBookingConfirmed } from "../userdata";
import { waitForFrontDeskGoodbyePlayout } from "../end-frontdesk-call";
import { executeScheduleAppointmentForSession } from "../runtime-schedule-appointment";
import {
  activateBookingWorkflow,
  activateMessageWorkflow,
  bookingFieldsComplete,
  bookingToolsActivateIntent,
  ensureReceptionistWorkflow,
  messageFieldsComplete,
  missingFieldsForPurpose,
  setWorkflowState,
  transitionAfterRecordField,
  transitionFromToolFeedback,
} from "./workflow-engine";
import {
  collectionStateSnapshot,
  clearCollectionPromptState,
  finishCollectionPrompt,
  logCollectionState,
} from "./collection-state-lifecycle";
import { processCollectionTurn } from "./collection-turn-processor";
import { processBookingSlotTurn } from "./booking-slot-turn-processor";
import type { ReceptionistCollectionPurpose } from "./workflow-types";
import { allowedToolNamesForWorkflow, workflowBlockedGuidance } from "./workflow-tool-surface";
import {
  askNextCollectionField,
  beginDeterministicFieldCollection,
  promptCollectionField,
} from "./deterministic-field-collection";
import { hasIncompleteCollectionBuffer } from "./collection-fragment-buffer";
import {
  bumpCollectionTurnSeq,
  controlledGenerateReply,
  isRuntimeCollectionState,
  syncCollectionRealtimeMode,
} from "./collection-realtime-control";

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
  clearCollectionPromptState(ud);
  await syncAgentToolSurface(session);
  await controlledGenerateReply(session, "booking_failure_recovery", bumpCollectionTurnSeq(ud), {
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
    const inCollection = isRuntimeCollectionState(ud);
    syncCollectionRealtimeMode(session, inCollection);
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

async function finishBookingCollectionAndListSlots(
  session: AgentSession<FrontDeskUserData>,
  reason: string,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  clearCollectionPromptState(ud);
  ud.collectionStuckNonFieldTurns = 0;
  ud.collectionStuckFieldId = undefined;

  if (!bookingFieldsComplete(ud)) {
    logOrchestrator(ud.callId, "booking_collection_incomplete", {
      reason,
      missingRequiredFields: missingFieldsForPurpose(ud, "booking").map((f) => f.id),
    });
    return;
  }

  if (wf.state === "BOOKING_COLLECT") {
    logOrchestrator(ud.callId, "collection_complete_escape", {
      reason,
      missingRequiredFields: [],
      completedFields: Object.keys(ud.receptionistFields || {}).filter((id) =>
        Boolean(ud.receptionistFields?.[id]?.trim()),
      ),
    });
    wf.state = "BOOKING_CHECK_AVAILABILITY";
    wf.activeFieldId = undefined;
    wf.requiredTool = undefined;
  }

  await syncAgentToolSurface(session);
  await runtimeListAvailableSlots(session);
}

function logFieldSaveProgress(
  ud: FrontDeskUserData,
  savedFieldId: string | undefined,
  savedValue: string | undefined,
): void {
  const wf = ensureReceptionistWorkflow(ud);
  const purpose = wf.collectionPurpose || "booking";
  const missing = missingFieldsForPurpose(ud, purpose).map((f) => f.id);
  logOrchestrator(ud.callId, "field_save_progress", {
    activeFieldId: wf.activeFieldId,
    savedFieldId,
    savedValue: savedValue?.slice(0, 80),
    completedFields: Object.keys(ud.receptionistFields || {}).filter((id) =>
      Boolean(ud.receptionistFields?.[id]?.trim()),
    ),
    missingRequiredFields: missing,
    nextState: wf.state,
    bookingFieldsComplete: purpose === "booking" ? bookingFieldsComplete(ud) : undefined,
  });
  logCollectionState(ud.callId, "field_saved", ud, { savedFieldId, savedValue: savedValue?.slice(0, 80) });

  if (purpose === "booking" && bookingFieldsComplete(ud) && wf.state === "BOOKING_COLLECT") {
    logOrchestrator(ud.callId, "collection_complete_stuck_invariant", {
      activeFieldId: wf.activeFieldId,
      missingRequiredFields: missing,
      completedFields: Object.keys(ud.receptionistFields || {}).filter((id) =>
        Boolean(ud.receptionistFields?.[id]?.trim()),
      ),
    });
  }
}

async function advanceCollectionAfterFieldSaved(
  session: AgentSession<FrontDeskUserData>,
  purpose: ReceptionistCollectionPurpose,
  savedFieldId?: string,
  savedValue?: string,
): Promise<void> {
  const ud = session.userData;
  if (hasIncompleteCollectionBuffer(ud)) {
    logOrchestrator(ud.callId, "collection_advance_suppressed", {
      reason: "incomplete_fragment_buffer",
      savedFieldId,
      phoneBuffer: ud.collectionPhoneDigitsBuffer,
      fragmentBuffers: ud.collectionFieldFragmentBuffers,
    });
    return;
  }
  const wf = ensureReceptionistWorkflow(ud);
  transitionAfterRecordField(ud, purpose);
  await syncAgentToolSurface(session);

  if (purpose === "booking" && bookingFieldsComplete(ud)) {
    if (wf.state === "BOOKING_COLLECT" || wf.state === "BOOKING_CHECK_AVAILABILITY") {
      await finishBookingCollectionAndListSlots(session, "all_required_fields_saved");
      return;
    }
  }

  if (wf.state === "BOOKING_CHECK_AVAILABILITY") {
    await runProactiveWorkflowStep(session);
    return;
  }
  if (wf.state === "BOOKING_COMMIT") {
    await runProactiveWorkflowStep(session);
    return;
  }
  if (wf.state === "MESSAGE_COMMIT") {
    await runProactiveWorkflowStep(session);
    return;
  }
  if (wf.state === "BOOKING_COLLECT" || wf.state === "MESSAGE_COLLECT") {
    await askNextCollectionField(session, purpose, savedFieldId, savedValue);
  }
}

function trackNonFieldCollectionUtterance(ud: FrontDeskUserData, activeFieldId?: string): void {
  const fieldId = activeFieldId || "none";
  if (ud.collectionStuckFieldId !== fieldId) {
    ud.collectionStuckFieldId = fieldId;
    ud.collectionStuckNonFieldTurns = 1;
  } else {
    ud.collectionStuckNonFieldTurns = (ud.collectionStuckNonFieldTurns ?? 0) + 1;
  }

  if ((ud.collectionStuckNonFieldTurns ?? 0) >= 3) {
    const purpose = ud.receptionistWorkflow?.collectionPurpose || "booking";
    logOrchestrator(ud.callId, "collection_stuck", {
      activeFieldId: fieldId,
      nonFieldTurns: ud.collectionStuckNonFieldTurns,
      missingRequiredFields: missingFieldsForPurpose(ud, purpose).map((f) => f.id),
      completedFields: Object.keys(ud.receptionistFields || {}).filter((id) =>
        Boolean(ud.receptionistFields?.[id]?.trim()),
      ),
    });
  }
}

function clearCollectionStuckWatchdog(ud: FrontDeskUserData): void {
  ud.collectionStuckFieldId = undefined;
  ud.collectionStuckNonFieldTurns = 0;
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

    await controlledGenerateReply(session, "availability_offered", bumpCollectionTurnSeq(ud), {
      instructions,
      toolChoice: "none",
    });
    setWorkflowState(ud, "BOOKING_SELECT_SLOT", { offeredSlotIds: wf.offeredSlotIds });
    await syncAgentToolSurface(session);
    logOrchestrator(ud.callId, "availability_offered", { slotCount: slots.length });
  } catch (err) {
    logOrchestrator(ud.callId, "availability_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    await controlledGenerateReply(session, "availability_failed", bumpCollectionTurnSeq(ud), {
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

/** Runtime-direct calendar write — only after BOOKING_CONFIRM_SLOT acceptance. */
export async function runtimeCommitBooking(
  session: AgentSession<FrontDeskUserData>,
  slotId?: string,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  const id = slotId || wf.selectedSlotId || ud.pendingSlotId || ud.bookingOperation?.slotId;
  if (!id || !bookingFieldsComplete(ud) || ud.bookingCommitInFlight) return;
  if (isBookingConfirmed(ud)) return;

  const offered = wf.offeredSlotIds ?? [];
  if (offered.length > 0 && !offered.includes(id)) {
    logOrchestrator(ud.callId, "commit_slot_not_offered", { slotId: id, offered });
    return;
  }

  const slotsMap = ud.receptionistSlotsMap;
  if (!slotsMap) {
    logOrchestrator(ud.callId, "commit_missing_slots_map");
    return;
  }

  ud.bookingCommitInFlight = true;
  setWorkflowState(ud, "BOOKING_COMMIT", { selectedSlotId: id });
  await syncAgentToolSurface(session);

  try {
    logOrchestrator(ud.callId, "runtime_commit_started", { slotId: id });
    const result = await executeScheduleAppointmentForSession(session, slotsMap, id);
    await afterReceptionistToolExecuted(session, "schedule_appointment", result);
  } catch (err) {
    logOrchestrator(ud.callId, "runtime_commit_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    ud.bookingCommitInFlight = false;
  }
}

async function runProactiveWorkflowStep(session: AgentSession<FrontDeskUserData>): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);

  switch (wf.state) {
    case "BOOKING_CHECK_AVAILABILITY":
      await runtimeListAvailableSlots(session);
      return;
    case "BOOKING_COMMIT":
      // Commit only enters via BOOKING_CONFIRM_SLOT acceptance — not proactive retry.
      return;
    case "BOOKING_DONE":
      if (isBookingConfirmed(ud) && wf.speechLocked) {
        await runtimeFinalizeTerminalSuccess(session);
      }
      return;
    case "MESSAGE_COMMIT":
      if (messageFieldsComplete(ud) && !ud.receptionistMessageTaken) {
        wf.requiredTool = "take_message";
        await controlledGenerateReply(session, "message_commit", bumpCollectionTurnSeq(ud), {
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
    }
  }
  if (intent === "message") {
    activateMessageWorkflow(ud);
    if (!messageFieldsComplete(ud)) {
      await beginDeterministicFieldCollection(session, "message", { skipFirstQuestion: true });
      await syncAgentToolSurface(session);
      await askNextCollectionField(session, "message");
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
  if (!feedback) {
    logOrchestrator(ud.callId, "tool_feedback_unparseable", {
      tool: toolName,
      rawPreview: rawResult.slice(0, 240),
    });
    return;
  }

  if (toolName === "record_current_field") {
    logOrchestrator(ud.callId, "record_field_obsolete", {
      outcome: feedback.outcome,
      note: "record_current_field removed — runtime saves from transcript",
    });
    return;
  }

  if (toolName === "take_message" && feedback.outcome === "success") {
    setWorkflowState(ud, "MESSAGE_DONE", { speechLocked: false, requiredTool: "end_call" });
  }

  if (toolName === "schedule_appointment" && feedback.outcome === "success") {
    const wf = ensureReceptionistWorkflow(ud);
    const slotId =
      typeof feedback.context?.slot_id === "string"
        ? feedback.context.slot_id
        : wf.selectedSlotId || ud.pendingSlotId;
    const bookedTimeLabel = ud.bookedTimeLabel || ud.booking?.bookedTimeLabel;
    if (slotId && bookedTimeLabel) {
      ud.bookingReceipt = {
        slotId,
        bookedTimeLabel,
        providerEventId: ud.booking?.providerEventId,
        appointmentId: ud.booking?.appointmentId,
      };
    }

    wf.speechLocked = true;
    wf.state = "BOOKING_DONE";
    wf.requiredTool = "end_call";
    wf.selectedSlotId = slotId || wf.selectedSlotId;
    await syncAgentToolSurface(session);
    logOrchestrator(ud.callId, "booking_done", {
      slotId,
      bookedTimeLabel,
      receipt: ud.bookingReceipt,
    });
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
    logOrchestrator(ud.callId, "list_slots_obsolete_model_path", {
      note: "runtime owns availability — model list_available_slots ignored",
    });
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
      next_action: "continue_conversation",
      runtime_handled_retry: true,
      guidance: workflowBlockedGuidance(ud, toolName),
    }),
  );
}

async function handleAvailabilityRequest(
  session: AgentSession<FrontDeskUserData>,
  transcript: string,
  turnId: number,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  trackNonFieldCollectionUtterance(ud, wf.activeFieldId);
  logOrchestrator(ud.callId, "availability_request_during_collection", {
    transcript,
    turn_id: turnId,
    bookingFieldsComplete: bookingFieldsComplete(ud),
  });

  if (bookingFieldsComplete(ud)) {
    await finishBookingCollectionAndListSlots(session, "caller_availability_request");
    return;
  }

  const missing = missingFieldsForPurpose(ud, "booking");
  const nextField = missing[0];
  clearCollectionPromptState(ud);
  syncCollectionRealtimeMode(session, false);
  try {
    await controlledGenerateReply(session, "availability_need_fields", turnId, {
      instructions:
        `The caller asked about availability or booking: "${transcript}". ` +
        "Answer in one short sentence that you can check availability once you have their details. " +
        "Do NOT ask any collection questions in this response.",
      toolChoice: "none",
    });
  } finally {
    if (isRuntimeCollectionState(ud)) {
      syncCollectionRealtimeMode(session, true);
      if (nextField?.question?.trim()) {
        await promptCollectionField(session, nextField.id, nextField.question);
      }
    }
  }
}

async function handleCollectionClarification(
  session: AgentSession<FrontDeskUserData>,
  transcript: string,
  turnId: number,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  trackNonFieldCollectionUtterance(ud, wf.activeFieldId);
  logOrchestrator(ud.callId, "collection_clarification", { transcript, turn_id: turnId });

  if (bookingFieldsComplete(ud) && wf.state === "BOOKING_COLLECT") {
    await finishBookingCollectionAndListSlots(session, "clarification_with_complete_fields");
    return;
  }

  syncCollectionRealtimeMode(session, false);
  try {
    await controlledGenerateReply(session, "collection_clarification", turnId, {
      instructions:
        `The caller said: "${transcript}". They are not answering the collection question yet. ` +
        "Answer briefly and honestly in one sentence. Do not claim an appointment is booked or confirmed unless the runtime already completed booking. " +
        "Do NOT ask any collection questions in this response.",
      toolChoice: "none",
    });
  } finally {
    if (isRuntimeCollectionState(ud)) {
      syncCollectionRealtimeMode(session, true);
      const manifest = ud.receptionistCompiled?.fieldManifest ?? [];
      const field = manifest.find((f) => f.id === wf.activeFieldId);
      if (field?.question?.trim()) {
        await promptCollectionField(session, field.id, field.question);
      }
    }
  }
}

function isRuntimeBookingSlotState(ud: FrontDeskUserData): boolean {
  const state = ud.receptionistWorkflow?.state;
  return state === "BOOKING_SELECT_SLOT" || state === "BOOKING_CONFIRM_SLOT";
}

function handleBookingUtterance(
  session: AgentSession<FrontDeskUserData>,
  transcript: string,
): void {
  const ud = session.userData;
  if (!isRuntimeBookingSlotState(ud)) return;

  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return;
  if (session.agentState === "speaking") return;
  if (ud.collectionFieldProcessing || ud.bookingTurnProcessing) return;

  ud.bookingTurnProcessing = true;
  void processBookingSlotTurn(session, normalizedTranscript, {
    log: (event, extra) => logOrchestrator(ud.callId, event, extra),
    commitBooking: runtimeCommitBooking,
  })
    .catch((err) => {
      logOrchestrator(ud.callId, "booking_slot_turn_error", {
        error: err instanceof Error ? err.message : String(err),
        transcript: normalizedTranscript,
      });
    })
    .finally(() => {
      ud.bookingTurnProcessing = false;
    });
}

function handleCollectionUtterance(
  session: AgentSession<FrontDeskUserData>,
  transcript: string,
): void {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  if (wf.state !== "BOOKING_COLLECT" && wf.state !== "MESSAGE_COLLECT") return;

  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return;
  if (session.agentState === "speaking") return;
  if (ud.collectionFieldProcessing) return;

  ud.collectionFieldProcessing = true;
  void processCollectionTurn(session, normalizedTranscript, {
    log: (event, extra) => logOrchestrator(ud.callId, event, extra),
    logFieldSaveProgress,
    clearCollectionStuckWatchdog,
    advanceCollectionAfterFieldSaved,
    handleAvailabilityRequest,
    handleCollectionClarification,
    bumpTurnId: bumpCollectionTurnSeq,
  })
    .catch((err) => {
      logOrchestrator(ud.callId, "collection_turn_error", {
        error: err instanceof Error ? err.message : String(err),
        transcript: normalizedTranscript,
      });
    })
    .finally(() => {
      ud.collectionFieldProcessing = false;
    });
}

export function attachReceptionistWorkflowOrchestrator(
  session: AgentSession<FrontDeskUserData>,
): void {
  const ud = session.userData;
  ensureReceptionistWorkflow(ud);
  syncCollectionRealtimeMode(session, false);
  void syncReceptionistToolSurface(session);

  session.on(AgentSessionEventTypes.UserInputTranscribed, (ev) => {
    if (!ev.isFinal) return;
    handleCollectionUtterance(session, ev.transcript);
    handleBookingUtterance(session, ev.transcript);
  });

  session.on(AgentSessionEventTypes.UserStateChanged, (ev) => {
    if (ev.newState !== "speaking") return;
    const wf = ensureReceptionistWorkflow(ud);
    wf.collectionLastSavedTranscript = undefined;
  });

  session.on(AgentSessionEventTypes.FunctionToolsExecuted, async (ev) => {
    for (let i = 0; i < ev.functionCalls.length; i++) {
      const call = ev.functionCalls[i];
      const output = ev.functionCallOutputs[i];
      if (!output?.output) continue;
      const rawResult = String(output.output);
      try {
        await afterReceptionistToolExecuted(session, call.name, rawResult);
      } catch (err) {
        logOrchestrator(ud.callId, "orchestrator_error", {
          tool: call.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}
