import type { WorkflowFieldSession } from "./types";

/** Per-call in-process cache — avoids repeated metadata reads during a LiveKit voice call. */
const cache = new Map<string, WorkflowFieldSession>();

export function getCachedWorkflowFieldSession(callId: string): WorkflowFieldSession | undefined {
  return cache.get(callId);
}

export function setCachedWorkflowFieldSession(callId: string, session: WorkflowFieldSession): void {
  cache.set(callId, session);
}

export function clearCachedWorkflowFieldSession(callId: string): void {
  cache.delete(callId);
}
