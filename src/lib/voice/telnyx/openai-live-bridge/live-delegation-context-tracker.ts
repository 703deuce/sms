type PendingDelegationContext = {
  eventId: string;
  episode: number;
  sentAtMs: number;
  acceptTimer: ReturnType<typeof setTimeout> | null;
};

export function createLiveDelegationContextTracker(input: {
  callId: string;
  onLog: (event: string, fields: Record<string, unknown>) => void;
}) {
  let pending: PendingDelegationContext | null = null;

  const clearPending = () => {
    if (pending?.acceptTimer) clearTimeout(pending.acceptTimer);
    pending = null;
  };

  const markSent = (eventId: string, episode: number) => {
    clearPending();
    const sentAtMs = Date.now();
    const acceptTimer = setTimeout(() => {
      if (!pending || pending.eventId !== eventId) return;
      input.onLog("DELEGATION_CONTEXT_ITEM_ACCEPTED", {
        callId: input.callId,
        event_id: eventId,
        episode,
        ack: "no_error_within_window_ms",
        elapsed_ms: Date.now() - sentAtMs,
      });
      clearPending();
    }, 450);
    pending = { eventId, episode, sentAtMs, acceptTimer };
  };

  const observeInbound = (liveEvent: Record<string, unknown>) => {
    if (!pending) return;
    const type = String(liveEvent.type || "");
    if (type === "error") {
      const err = (liveEvent.error ?? liveEvent) as Record<string, unknown>;
      input.onLog("DELEGATION_CONTEXT_ITEM_ERROR", {
        callId: input.callId,
        event_id: pending.eventId,
        episode: pending.episode,
        code: err.code ?? null,
        message: err.message ?? null,
      });
      clearPending();
      return;
    }
    if (type === "session.command.rejected") {
      input.onLog("DELEGATION_CONTEXT_ITEM_ERROR", {
        callId: input.callId,
        event_id: pending.eventId,
        episode: pending.episode,
        code: "session.command.rejected",
        message: String(liveEvent.reason ?? liveEvent.message ?? ""),
      });
      clearPending();
    }
  };

  return { markSent, observeInbound, clearPending };
}
