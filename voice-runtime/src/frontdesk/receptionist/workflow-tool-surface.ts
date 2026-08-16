import type { ReceptionistWorkflowSnapshot } from "./workflow-types";
import { isBookingConfirmed } from "../userdata";
import type { FrontDeskUserData } from "../userdata";
import { bookingFieldsComplete, ensureReceptionistWorkflow, messageFieldsComplete } from "./workflow-engine";

/** Tools always available unless speech is locked or in strict collection/commit states. */
const ALWAYS_AVAILABLE = new Set([
  "get_current_time",
  "end_call",
]);

const BOOKING_READ_TOOLS = new Set([
  "check_booking_status",
  "cancel_appointment",
  "reschedule_appointment",
]);

const BOOKING_WRITE_TOOLS = new Set([
  "list_available_slots",
  "schedule_appointment",
  "record_booking_email",
  "decline_booking_email",
]);

export function allowedToolNamesForWorkflow(
  ud: FrontDeskUserData,
  allToolNames: string[],
): Set<string> {
  const wf = ensureReceptionistWorkflow(ud);
  const allowed = new Set<string>();

  for (const name of allToolNames) {
    if (isToolAllowedInWorkflow(ud, wf, name)) {
      allowed.add(name);
    }
  }
  return allowed;
}

export function isToolAllowedInWorkflow(
  ud: FrontDeskUserData,
  wf: ReceptionistWorkflowSnapshot,
  toolName: string,
): boolean {
  if (wf.speechLocked) {
    return toolName === "end_call" || toolName === "get_business_answer";
  }

  if (wf.state === "BOOKING_COLLECT" || wf.state === "MESSAGE_COLLECT") {
    return toolName === "end_call";
  }

  if (ALWAYS_AVAILABLE.has(toolName)) {
    if (toolName === "take_message") {
      return wf.state === "MESSAGE_COMMIT" && messageFieldsComplete(ud);
    }
    return true;
  }

  switch (wf.state) {
    case "IDLE":
      if (toolName === "record_current_field" || toolName === "set_workflow_intent") {
        return true;
      }
      if (toolName === "get_business_answer") return true;
      if (toolName === "take_message") {
        return messageFieldsComplete(ud);
      }
      if (BOOKING_WRITE_TOOLS.has(toolName) || BOOKING_READ_TOOLS.has(toolName)) {
        return true;
      }
      if (toolName === "transfer_to_human" || toolName === "send_sms") return true;
      return false;

    case "BOOKING_CHECK_AVAILABILITY":
    case "BOOKING_COMMIT":
      return false;

    case "BOOKING_OFFER_SLOTS":
    case "BOOKING_AWAIT_SLOT":
    case "BOOKING_CONFIRM_SLOT":
      return toolName === "schedule_appointment" || toolName === "get_business_answer";

    case "BOOKING_DONE":
      return toolName === "end_call" || toolName === "get_business_answer";

    case "BOOKING_FAILED":
      return (
        toolName === "list_available_slots" ||
        toolName === "schedule_appointment" ||
        toolName === "take_message" ||
        toolName === "record_current_field" ||
        toolName === "get_business_answer" ||
        toolName === "end_call"
      );

    case "MESSAGE_COMMIT":
      return (
        toolName === "take_message" ||
        toolName === "get_business_answer" ||
        toolName === "end_call"
      );

    case "MESSAGE_DONE":
    case "END":
      return toolName === "end_call" || toolName === "get_business_answer";

    case "TRANSFER_PREPARE":
    case "TRANSFER_CONNECT":
      return toolName === "transfer_to_human" || toolName === "get_business_answer" || toolName === "end_call";

    case "TRANSFER_DONE":
      return toolName === "end_call" || toolName === "get_business_answer";

    case "FAQ":
      return toolName === "get_business_answer" || toolName === "end_call";

    default:
      return false;
  }
}

export function workflowBlockedGuidance(
  ud: FrontDeskUserData,
  toolName: string,
): string {
  const wf = ensureReceptionistWorkflow(ud);
  const required = wf.requiredTool || "the required workflow tool";
  if (wf.state === "BOOKING_COLLECT" || wf.state === "MESSAGE_COLLECT") {
    const field = wf.activeFieldId || "the active field";
    return (
      `Workflow state ${wf.state}: ${toolName} is not allowed. ` +
      `The runtime is collecting ${field} from the caller transcript — do not call tools for field capture.`
    );
  }
  if (wf.speechLocked && isBookingConfirmed(ud)) {
    return (
      "Booking is confirmed. Do not contradict the outcome. " +
      "If the caller is done, call end_call."
    );
  }
  return (
    `Workflow state ${wf.state}: ${toolName} is not allowed right now. ` +
    `Required next step: ${required}.`
  );
}
