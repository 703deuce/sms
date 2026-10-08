/**
 * Pure allocation policy helpers (no server-only — safe for vitest).
 */

export type ConsumerSenderWorkspacePair = {
  platformPhoneNumberId: string;
  workspaceId: string;
};

/** Platform senders already tied to another workspace for this customer. */
export function occupiedPlatformSendersForWorkspace(input: {
  requestingWorkspaceId: string;
  pairs: ConsumerSenderWorkspacePair[];
}): Set<string> {
  const occupied = new Set<string>();
  for (const p of input.pairs) {
    if (p.workspaceId !== input.requestingWorkspaceId) {
      occupied.add(p.platformPhoneNumberId);
    }
  }
  return occupied;
}

/** After a unique violation, try the next sender when more candidates remain. */
export function shouldRetryPlatformSenderAllocation(input: {
  candidateIndex: number;
  candidateCount: number;
  errorCode?: string;
  transactionReturnedNull: boolean;
}): boolean {
  if (input.transactionReturnedNull) return true;
  if (input.errorCode === "P2002" && input.candidateIndex + 1 < input.candidateCount) {
    return true;
  }
  return false;
}
