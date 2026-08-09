import type { TransferPhase, TransferState } from "@/lib/voice/session-runtime/types";

export type TransferEvent =
  | { type: "request"; destination: string; destinationLabel?: string }
  | { type: "dialing" }
  | { type: "answered" }
  | { type: "handoff_complete" }
  | { type: "no_answer" }
  | { type: "busy" }
  | { type: "failed"; reason?: string }
  | { type: "returned_to_agent"; fallbackAction?: string };

const TRANSITIONS: Record<TransferPhase, Partial<Record<TransferEvent["type"], TransferPhase>>> = {
  idle: { request: "requested" },
  requested: { dialing: "dialing" },
  dialing: {
    answered: "answered",
    no_answer: "no_answer",
    busy: "busy",
    failed: "failed",
  },
  answered: { handoff_complete: "handoff_complete" },
  handoff_complete: {},
  no_answer: { returned_to_agent: "returned_to_agent" },
  busy: { returned_to_agent: "returned_to_agent" },
  failed: { returned_to_agent: "returned_to_agent" },
  returned_to_agent: {},
};

export function initialTransferState(): TransferState {
  return { phase: "idle" };
}

export function applyTransferEvent(
  current: TransferState,
  event: TransferEvent,
): TransferState {
  const nextPhase = TRANSITIONS[current.phase]?.[event.type];
  if (!nextPhase) return current;

  const now = new Date().toISOString();
  const next: TransferState = { ...current, phase: nextPhase };

  if (event.type === "request") {
    next.destination = event.destination;
    next.destinationLabel = event.destinationLabel;
    next.startedAt = now;
  }
  if (event.type === "failed") {
    next.failureReason = event.reason || "transfer_failed";
  }
  if (event.type === "returned_to_agent") {
    next.fallbackAction = event.fallbackAction || "take_message";
    next.completedAt = now;
  }
  if (["no_answer", "busy", "failed", "handoff_complete"].includes(nextPhase)) {
    next.completedAt = now;
  }

  return next;
}

export function transferRequiresRecovery(state: TransferState): boolean {
  return state.phase === "returned_to_agent";
}

export function transferInProgress(state: TransferState): boolean {
  return ["requested", "dialing", "answered"].includes(state.phase);
}

export function speakableTransferMessage(state: TransferState): string {
  switch (state.phase) {
    case "requested":
    case "dialing":
      return "I'm connecting you now. One moment please.";
    case "answered":
    case "handoff_complete":
      return "You're connected. I'll let you take it from here.";
    case "no_answer":
    case "busy":
    case "failed":
    case "returned_to_agent":
      return "I wasn't able to reach someone right now. I can take a message and make sure the team gets it.";
    default:
      return "Let me connect you with someone who can help.";
  }
}
