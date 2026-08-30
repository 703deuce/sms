/**
 * Legacy Caller Amy voice orchestration (workflow-engine + Telnyx runtime_turn).
 *
 * LEGACY / TEST ONLY — production Realtor and frontdesk agents use LiveKit AgentSession
 * with direct tools and optional AgentTasks. Do not route new product work here.
 */

/** Retired gateway — direct webhook tools (continue_workflow, get_runtime_context) remain active. */
export const LEGACY_WORKFLOW_VOICE_TOOL_TYPES = new Set(["runtime_turn"]);

/** Explicit opt-in for scripts and migration tests only. */
export function isLegacyWorkflowVoicePathEnabled(): boolean {
  return process.env.ALLOW_LEGACY_WORKFLOW_VOICE === "1";
}

export function assertLegacyWorkflowVoiceToolAllowed(toolType: string): void {
  if (!LEGACY_WORKFLOW_VOICE_TOOL_TYPES.has(toolType)) return;
  if (isLegacyWorkflowVoicePathEnabled()) return;
  throw new Error(
    `Legacy workflow voice tool "${toolType}" is retired from production. ` +
      "Use LiveKit AgentSession with direct tools or AgentTasks. " +
      "Set ALLOW_LEGACY_WORKFLOW_VOICE=1 only for migration tests.",
  );
}

export const LEGACY_VOICE_PATH_BANNER =
  "LEGACY / TEST ONLY — workflow-engine voice path. Not for production Realtor or frontdesk.";
