import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";

export type LiveSessionRuntime = {
  liveSessionId: string;
  callId: string;
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  bundle: ReceptionistPublishedBundle;
  intake: Record<string, unknown>;
};

const sessions = new Map<string, LiveSessionRuntime>();

export function putLiveSession(runtime: LiveSessionRuntime): void {
  sessions.set(runtime.liveSessionId, runtime);
}

export function getLiveSession(liveSessionId: string): LiveSessionRuntime | null {
  return sessions.get(liveSessionId.trim()) ?? null;
}

export function clearLiveSession(liveSessionId: string): void {
  sessions.delete(liveSessionId.trim());
}
