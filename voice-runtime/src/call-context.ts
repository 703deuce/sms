import type { AgentSession } from "@livekit/agents";
import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import type { AmyUserData } from "./metadata";

export function requireCallContext(session: AgentSession<AmyUserData>): LiveKitCallContext {
  const ctx = session.userData.callContext;
  if (!ctx) throw new Error("Call context not initialized");
  return ctx;
}

export function stashCallContext(session: AgentSession<AmyUserData>, ctx: LiveKitCallContext): void {
  session.userData = { ...session.userData, callContext: ctx };
}
