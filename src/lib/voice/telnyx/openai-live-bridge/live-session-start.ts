import crypto from "node:crypto";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import { resolveOpenAiLiveBaseline } from "../openai-realtime-bridge/live-config";
import { buildLiveSessionConfig } from "./build-live-session-config";
import { isOpenAiLiveSplitPromptsEnabled } from "./constants";
import { buildLiveDelegationTools } from "./live-tools";

export function buildOpenAiLiveSplitSessionStartPayload(
  sessionOverrides?: Record<string, unknown>,
): Record<string, unknown> {
  const session = {
    ...buildLiveSessionConfig(),
    ...sessionOverrides,
  };
  return {
    type: "session.start",
    event_id: `live_start_${crypto.randomUUID()}`,
    session,
  };
}

/**
 * Session.start with agent-scoped tools when OPENAI_LIVE_DELEGATION=1.
 */
export async function buildOpenAiLiveSessionStartPayloadForCall(
  claims: RealtimeBridgeStreamClaims,
  input?: {
    businessContext?: string;
    greeting?: string;
    callerContext?: string;
    bookingContext?: string;
    runtimeContext?: string;
  },
): Promise<Record<string, unknown>> {
  const config = await loadVoiceAgentRuntimeConfig(claims.workspaceId, claims.agentId);
  const parsed = parseVoiceAgentConfig(config);
  const handling = resolveAfterHoursHandlingFromAgentConfig(parsed);
  const tools = buildLiveDelegationTools({
    config: parsed,
    transferEnabled: Boolean(handling?.transferEnabled),
  });

  const session = buildLiveSessionConfig({
    businessContext: input?.businessContext,
    greeting: input?.greeting,
    callerContext: input?.callerContext,
    bookingContext: input?.bookingContext,
    runtimeContext: input?.runtimeContext,
    tools,
  });

  return {
    type: "session.start",
    event_id: `live_start_${crypto.randomUUID()}`,
    session,
  };
}

export function shouldUseSplitLiveSessionStart(): boolean {
  if (!isOpenAiLiveSplitPromptsEnabled()) return false;
  const baseline = resolveOpenAiLiveBaseline();
  return baseline === "G";
}
