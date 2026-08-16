import type { AgentSession } from "@livekit/agents";

/** Best-effort interrupt — LiveKit returns a Future, not a Promise. */
export async function safeInterruptSession<T>(session: AgentSession<T>): Promise<void> {
  if (!isAgentSessionAlive(session)) return;
  try {
    await session.interrupt({ force: true }).await;
  } catch {
    // Caller may have already interrupted; tool handoff should continue.
  }
}

/** Whether scripted speech / generateReply can still run on this session. */
export function isAgentSessionAlive<T>(session: AgentSession<T>): boolean {
  const ud = session.userData as { callClosing?: boolean } | undefined;
  if (ud?.callClosing) return false;
  try {
    void session.agentState;
    return true;
  } catch {
    return false;
  }
}
