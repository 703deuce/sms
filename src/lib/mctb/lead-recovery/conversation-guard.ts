/**
 * Lead Recovery — inbound ordering, dedupe, and stale-action guards (text channel).
 */
import type { LeadRecoveryConversationState, StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

const locks = new Map<string, Promise<void>>();

export function defaultGuardFields(): Pick<
  LeadRecoveryConversationState,
  "stateVersion" | "pendingActionEpoch" | "processedInboundIds" | "pendingAction"
> {
  return {
    stateVersion: 0,
    pendingActionEpoch: 0,
    processedInboundIds: [],
    pendingAction: null,
  };
}

export function withLeadRecoveryConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = locks.get(conversationId) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prev.then(() => gate);
  locks.set(conversationId, chain);
  return prev
    .then(() => fn())
    .finally(() => {
      release();
      if (locks.get(conversationId) === chain) locks.delete(conversationId);
    });
}

export function registerInboundProviderMessage(
  state: LeadRecoveryConversationState,
  providerMessageId?: string | null,
): { state: LeadRecoveryConversationState; duplicate: boolean } {
  if (!providerMessageId?.trim()) {
    return { state: bumpStateVersion(state), duplicate: false };
  }
  const id = providerMessageId.trim();
  const seen = state.processedInboundIds ?? [];
  if (seen.includes(id)) {
    return { state, duplicate: true };
  }
  const nextIds = [...seen, id].slice(-200);
  return {
    state: bumpStateVersion({
      ...state,
      processedInboundIds: nextIds,
    }),
    duplicate: false,
  };
}

export function bumpStateVersion(state: LeadRecoveryConversationState): LeadRecoveryConversationState {
  return {
    ...state,
    stateVersion: (state.stateVersion ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function invalidatePendingActions(
  state: LeadRecoveryConversationState,
): LeadRecoveryConversationState {
  return bumpStateVersion({
    ...state,
    pendingAction: null,
    pendingActionEpoch: (state.pendingActionEpoch ?? 0) + 1,
    activeAction: null,
    phase: state.phase === "EXECUTE" ? "IDLE" : state.phase,
  });
}

export function markPendingAction(
  state: LeadRecoveryConversationState,
  action: NonNullable<LeadRecoveryConversationState["pendingAction"]>,
): LeadRecoveryConversationState {
  const epoch = state.stateVersion ?? 0;
  return {
    ...state,
    pendingAction: { ...action, epoch },
    activeAction: action.action,
  };
}

export function isPendingActionStale(
  state: LeadRecoveryConversationState,
  epoch: number,
): boolean {
  return epoch !== (state.pendingActionEpoch ?? 0) && epoch !== (state.stateVersion ?? 0);
}

/** Merge burst fragments into one logical customer utterance (in-process cert helper). */
export function mergeBurstFragments(messages: string[], gapMs: number[]): string {
  if (messages.length <= 1) return messages[0] || "";
  const parts: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const gap = i === 0 ? 0 : gapMs[i - 1] ?? 0;
    if (i > 0 && gap > 5000) parts.push("\n");
    else if (i > 0) parts.push(" ");
    parts.push(messages[i].trim());
  }
  return parts.join("").trim();
}
