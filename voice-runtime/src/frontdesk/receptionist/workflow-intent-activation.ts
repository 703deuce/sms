import type { AgentSession } from "@livekit/agents";
import type { FrontDeskUserData } from "../userdata";
import { isBookingConfirmed } from "../userdata";
import {
  activateBookingWorkflow,
  activateMessageWorkflow,
  bookingFieldsComplete,
  ensureReceptionistWorkflow,
  messageFieldsComplete,
  setWorkflowState,
} from "./workflow-engine";
import type { ReceptionistWorkflowIntent } from "./workflow-types";
import { detectWorkflowIntentFromUtterance } from "./workflow-intent-detection";
import { beginReceptionistCollection, syncReceptionistToolSurface } from "./workflow-orchestrator";

export type DeclaredWorkflowIntent =
  | "book_appointment"
  | "leave_message"
  | "speak_to_human"
  | "business_question";

function mapDeclaredIntent(intent: DeclaredWorkflowIntent): ReceptionistWorkflowIntent {
  switch (intent) {
    case "book_appointment":
      return "booking";
    case "leave_message":
      return "message";
    case "speak_to_human":
      return "transfer";
    case "business_question":
      return "faq";
  }
}

/** Hard-route caller intent into workflow state — runtime owns transitions from here. */
export async function activateWorkflowIntent(
  session: AgentSession<FrontDeskUserData>,
  intent: DeclaredWorkflowIntent,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  if (wf.state !== "IDLE" && wf.intent !== "none") return;
  if (isBookingConfirmed(ud)) return;

  const mapped = mapDeclaredIntent(intent);
  wf.intent = mapped;

  switch (mapped) {
    case "booking":
      activateBookingWorkflow(ud);
      if (!bookingFieldsComplete(ud)) {
        await beginReceptionistCollection(session, "booking");
      } else {
        setWorkflowState(ud, "BOOKING_CHECK_AVAILABILITY");
        await syncReceptionistToolSurface(session);
      }
      return;
    case "message":
      activateMessageWorkflow(ud);
      if (!messageFieldsComplete(ud)) {
        await beginReceptionistCollection(session, "message");
      } else {
        setWorkflowState(ud, "MESSAGE_COMMIT", { requiredTool: "take_message" });
        await syncReceptionistToolSurface(session);
      }
      return;
    case "transfer":
      setWorkflowState(ud, "TRANSFER_PREPARE", { requiredTool: "transfer_to_human" });
      await syncReceptionistToolSurface(session);
      return;
    case "faq":
      setWorkflowState(ud, "FAQ");
      await syncReceptionistToolSurface(session);
      return;
    default:
      return;
  }
}

export async function maybeActivateWorkflowFromUtterance(
  session: AgentSession<FrontDeskUserData>,
  text: string,
): Promise<void> {
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  if (wf.state !== "IDLE" || wf.intent !== "none") return;

  const detected = detectWorkflowIntentFromUtterance(text);
  if (!detected) return;

  if (detected === "booking") {
    await activateWorkflowIntent(session, "book_appointment");
  } else if (detected === "message") {
    await activateWorkflowIntent(session, "leave_message");
  } else if (detected === "transfer") {
    await activateWorkflowIntent(session, "speak_to_human");
  }
}
