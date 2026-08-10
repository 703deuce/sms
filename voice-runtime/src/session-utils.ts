import type { AgentSession } from "@livekit/agents";

/** Best-effort interrupt — LiveKit returns a Future, not a Promise. */
export async function safeInterruptSession(session: AgentSession<unknown>): Promise<void> {
  try {
    await session.interrupt({ force: true }).await;
  } catch {
    // Caller may have already interrupted; tool handoff should continue.
  }
}
