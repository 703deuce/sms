import { loadLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import type { LeadRecoveryActionId } from "@/lib/mctb/lead-recovery/types";

export type ProviderWriteAuthResult =
  | { ok: true; stateVersion: number }
  | { ok: false; reason: "stale" | "cancelled"; customerMessage: string };

export async function authorizeProviderWrite(input: {
  workspaceId: string;
  conversationId: string;
  action: LeadRecoveryActionId;
  writeEpoch: number;
}): Promise<ProviderWriteAuthResult> {
  const state = await loadLeadRecoveryState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });
  const currentEpoch = state.pendingActionEpoch ?? state.stateVersion ?? 0;
  if (input.writeEpoch !== currentEpoch && input.writeEpoch !== (state.stateVersion ?? 0)) {
    return {
      ok: false,
      reason: "stale",
      customerMessage: "That request is no longer active. How can I help now?",
    };
  }
  if (!state.pendingAction && state.pendingActionEpoch !== input.writeEpoch) {
    return {
      ok: false,
      reason: "cancelled",
      customerMessage: "Okay — I won't do that. What would you like instead?",
    };
  }
  return { ok: true, stateVersion: state.stateVersion ?? 0 };
}
