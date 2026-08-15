import type { AgentSession } from "@livekit/agents";
import {
  resolveOutboundRealtimeOutputMode,
  type OutboundRealtimeOutputMode,
} from "./pipeline";
import type { FrontDeskUserData } from "./frontdesk/userdata";

/**
 * Resolve half-cascade vs native realtime for scripted speech on this session.
 * Must use session snapshot — env-only resolution misses inbound receptionist config.
 */
export function resolveSessionScriptedSpeechOutputMode(
  session: AgentSession<unknown>,
): OutboundRealtimeOutputMode {
  const ud = session.userData as FrontDeskUserData | undefined;
  const fromCompiled = ud?.receptionistCompiled?.realtimeOutputMode;
  if (fromCompiled === "elevenlabs") return "elevenlabs";
  if (fromCompiled === "native") return "native";
  return resolveOutboundRealtimeOutputMode();
}

export function sessionUsesTtsSay(session: AgentSession<unknown>): boolean {
  return resolveSessionScriptedSpeechOutputMode(session) === "elevenlabs";
}
