import "server-only";

export class VoiceV3AgentConfigResolutionError extends Error {
  readonly code = "VOICE_V3_AGENT_CONFIG_RESOLUTION_FAILED";

  constructor(
    message: string,
    readonly details: {
      workspaceId: string;
      agentId: string;
      agentStatus?: string | null;
      reason: string;
    },
  ) {
    super(message);
    this.name = "VoiceV3AgentConfigResolutionError";
  }
}

/**
 * Demo/env booking config (Amy/Transovo cert defaults) is allowed only in
 * non-production or when explicitly opted in — never silently for ACTIVE PSTN agents in production.
 */
export function voiceV3AllowsDemoConfigFallback(): boolean {
  const explicit = process.env.VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK?.trim().toLowerCase();
  if (explicit === "1" || explicit === "true" || explicit === "yes") return true;
  if (explicit === "0" || explicit === "false" || explicit === "no") return false;
  return process.env.NODE_ENV !== "production";
}

export function assertActiveAgentMayUseDemoConfigFallback(input: {
  workspaceId: string;
  agentId: string;
  agentStatus?: string | null;
  reason: string;
}): void {
  const status = (input.agentStatus ?? "").trim().toUpperCase();
  if (status !== "ACTIVE") return;
  if (voiceV3AllowsDemoConfigFallback()) return;

  throw new VoiceV3AgentConfigResolutionError(
    "ACTIVE Voice agent is missing a valid wizard-backed configuration; demo env fallback is disabled in production.",
    {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      agentStatus: input.agentStatus,
      reason: input.reason,
    },
  );
}
