import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import {
  missingReceptionistFields,
  type ReceptionistCollectionPurpose as ScopePurpose,
} from "@/lib/voice/receptionist/field-collection-scope";
import type { ToolFeedback, ToolNextAction } from "@/lib/voice/tool-feedback";
import type { FrontDeskUserData } from "../userdata";
import { isBookingConfirmed } from "../userdata";
import {
  INITIAL_RECEPTIONIST_WORKFLOW,
  type ReceptionistCollectionPurpose,
  type ReceptionistWorkflowIntent,
  type ReceptionistWorkflowSnapshot,
  type ReceptionistWorkflowState,
} from "./workflow-types";

export type { ReceptionistCollectionPurpose };

export function ensureReceptionistWorkflow(ud: FrontDeskUserData): ReceptionistWorkflowSnapshot {
  if (!ud.receptionistWorkflow) {
    ud.receptionistWorkflow = { ...INITIAL_RECEPTIONIST_WORKFLOW };
  }
  return ud.receptionistWorkflow;
}

export function setWorkflowState(
  ud: FrontDeskUserData,
  state: ReceptionistWorkflowState,
  patch?: Partial<ReceptionistWorkflowSnapshot>,
): ReceptionistWorkflowSnapshot {
  const wf = ensureReceptionistWorkflow(ud);
  wf.state = state;
  if (patch) Object.assign(wf, patch);
  return wf;
}

export function activateBookingWorkflow(ud: FrontDeskUserData): ReceptionistWorkflowSnapshot {
  const wf = ensureReceptionistWorkflow(ud);
  wf.intent = "booking";
  return wf;
}

export function activateMessageWorkflow(ud: FrontDeskUserData): ReceptionistWorkflowSnapshot {
  const wf = ensureReceptionistWorkflow(ud);
  wf.intent = "message";
  return wf;
}

function manifest(ud: FrontDeskUserData): AgentFieldDefinition[] {
  return ud.receptionistCompiled?.fieldManifest ?? [];
}

function scopePurpose(purpose: ReceptionistCollectionPurpose): ScopePurpose {
  if (purpose === "message") return "message";
  if (purpose === "booking") return "booking";
  return "service";
}

export function firstMissingFieldForPurpose(
  ud: FrontDeskUserData,
  purpose: ReceptionistCollectionPurpose,
): AgentFieldDefinition | undefined {
  const missing = missingReceptionistFields(
    manifest(ud),
    ud.receptionistFields,
    scopePurpose(purpose),
  );
  return missing[0];
}

export function missingFieldsForPurpose(
  ud: FrontDeskUserData,
  purpose: ReceptionistCollectionPurpose,
): AgentFieldDefinition[] {
  return missingReceptionistFields(manifest(ud), ud.receptionistFields, scopePurpose(purpose));
}

export function messageFieldsComplete(ud: FrontDeskUserData): boolean {
  const fields = ud.receptionistFields || {};
  const hasName = Boolean(fields.name?.trim());
  const hasPhone = Boolean(fields.phone?.trim());
  const hasReason = Boolean(fields.reason?.trim());
  return hasName && hasPhone && hasReason;
}

export function bookingFieldsComplete(ud: FrontDeskUserData): boolean {
  return missingFieldsForPurpose(ud, "booking").length === 0;
}

export function enterCollectionState(
  ud: FrontDeskUserData,
  purpose: ReceptionistCollectionPurpose,
): ReceptionistWorkflowSnapshot {
  const wf = purpose === "message" ? activateMessageWorkflow(ud) : activateBookingWorkflow(ud);
  const state: ReceptionistWorkflowState =
    purpose === "message" ? "MESSAGE_COLLECT" : "BOOKING_COLLECT";
  const first = firstMissingFieldForPurpose(ud, purpose);
  wf.state = state;
  wf.collectionPurpose = purpose;
  wf.activeFieldId = first?.id;
  wf.requiredTool = "record_current_field";
  wf.speechLocked = false;
  return wf;
}

/** Map legacy next_action tokens to runtime workflow transitions. */
export function transitionFromToolFeedback(
  ud: FrontDeskUserData,
  toolName: string,
  feedback: ToolFeedback,
): ReceptionistWorkflowSnapshot {
  const wf = ensureReceptionistWorkflow(ud);
  const action = feedback.next_action;

  if (feedback.caller_already_heard_success || isBookingConfirmed(ud)) {
    if (toolName === "schedule_appointment" || wf.intent === "booking") {
      wf.speechLocked = true;
      wf.state = "BOOKING_DONE";
      wf.requiredTool = "end_call";
      return wf;
    }
  }

  switch (action) {
    case "do_not_speak":
      return wf;
    case "offer_slots_and_confirm":
      wf.state = "BOOKING_OFFER_SLOTS";
      wf.requiredTool = "schedule_appointment";
      return wf;
    case "list_slots_then_retry":
      wf.state = "BOOKING_CHECK_AVAILABILITY";
      wf.requiredTool = undefined;
      return wf;
    case "schedule_appointment_retry":
      wf.state = "BOOKING_COMMIT";
      wf.requiredTool = undefined;
      return wf;
    case "collect_field_then_retry":
    case "record_field_then_retry":
    case "collect_email_then_retry":
      if (wf.intent === "message") {
        wf.state = "MESSAGE_COLLECT";
        wf.collectionPurpose = "message";
      } else {
        wf.state = "BOOKING_COLLECT";
        wf.collectionPurpose = "booking";
      }
      wf.activeFieldId =
        feedback.field_id ||
        firstMissingFieldForPurpose(ud, wf.collectionPurpose || "booking")?.id;
      wf.requiredTool = "record_current_field";
      return wf;
    case "collect_booking_requirements":
      wf.intent = "booking";
      wf.state = "BOOKING_COLLECT";
      wf.collectionPurpose = "booking";
      wf.activeFieldId = firstMissingFieldForPurpose(ud, "booking")?.id;
      wf.requiredTool = "record_current_field";
      return wf;
    case "take_message":
      wf.intent = "message";
      if (messageFieldsComplete(ud)) {
        wf.state = "MESSAGE_COMMIT";
        wf.requiredTool = "take_message";
      } else {
        wf.state = "MESSAGE_COLLECT";
        wf.collectionPurpose = "message";
        wf.activeFieldId = firstMissingFieldForPurpose(ud, "message")?.id;
        wf.requiredTool = "record_current_field";
      }
      return wf;
    case "end_call":
      wf.state = "END";
      wf.requiredTool = "end_call";
      wf.speechLocked = true;
      return wf;
    case "check_booking_status":
      if (isBookingConfirmed(ud)) {
        wf.state = "BOOKING_DONE";
        wf.speechLocked = true;
        wf.requiredTool = "end_call";
      }
      return wf;
    case "continue_conversation":
      if (wf.state === "IDLE" && wf.intent === "none") return wf;
      return wf;
    default:
      return wf;
  }
}

export function transitionAfterRecordField(
  ud: FrontDeskUserData,
  purpose: ReceptionistCollectionPurpose,
): ReceptionistWorkflowSnapshot {
  const wf = ensureReceptionistWorkflow(ud);
  const next = firstMissingFieldForPurpose(ud, purpose);
  if (next) {
    wf.activeFieldId = next.id;
    wf.requiredTool = "record_current_field";
    if (purpose === "message") {
      wf.state = "MESSAGE_COLLECT";
    } else {
      wf.state = "BOOKING_COLLECT";
    }
    return wf;
  }

  if (purpose === "message") {
    wf.state = "MESSAGE_COMMIT";
    wf.requiredTool = "take_message";
    wf.activeFieldId = undefined;
    return wf;
  }

  const pendingSlot = ud.pendingSlotId || ud.bookingOperation?.slotId;
  if (pendingSlot) {
    wf.state = "BOOKING_COMMIT";
    wf.requiredTool = undefined;
    wf.activeFieldId = undefined;
    return wf;
  }

  wf.state = "BOOKING_CHECK_AVAILABILITY";
  wf.requiredTool = undefined;
  wf.activeFieldId = undefined;
  return wf;
}

export function bookingToolsActivateIntent(toolName: string): ReceptionistWorkflowIntent | null {
  if (toolName === "set_workflow_intent") return null;
  if (
    toolName === "list_available_slots" ||
    toolName === "schedule_appointment" ||
    toolName === "record_booking_email" ||
    toolName === "decline_booking_email"
  ) {
    return "booking";
  }
  if (toolName === "take_message") return "message";
  if (toolName === "transfer_to_human") return "transfer";
  if (toolName === "get_business_answer") return "faq";
  return null;
}

export function runtimeNextActionForState(
  state: ReceptionistWorkflowState,
): ToolNextAction | undefined {
  switch (state) {
    case "BOOKING_CHECK_AVAILABILITY":
      return "list_slots_then_retry";
    case "BOOKING_OFFER_SLOTS":
      return "offer_slots_and_confirm";
    case "BOOKING_COMMIT":
      return "schedule_appointment_retry";
    case "BOOKING_DONE":
    case "MESSAGE_DONE":
    case "TRANSFER_DONE":
    case "END":
      return "end_call";
    case "MESSAGE_COMMIT":
      return "take_message";
    default:
      return undefined;
  }
}
