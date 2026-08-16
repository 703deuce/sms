import type { ReceptionistWorkflowIntent } from "./workflow-types";

/** Lightweight utterance heuristics — runtime backup when the model has not called set_workflow_intent yet. */
export function detectWorkflowIntentFromUtterance(text: string): ReceptionistWorkflowIntent | null {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.length < 4) return null;

  const booking =
    /\b(book|booking|appointment|schedule|come out|service visit|technician|estimate|available|opening)\b/.test(
      lower,
    );
  const message =
    /\b(callback|call me back|leave a message|take a message|someone call|follow up|get back to me)\b/.test(
      lower,
    );
  const transfer =
    /\b(speak to|talk to|human|representative|real person|operator|manager|transfer)\b/.test(
      lower,
    );

  if (transfer) return "transfer";
  if (message && !booking) return "message";
  if (booking) return "booking";
  return null;
}
