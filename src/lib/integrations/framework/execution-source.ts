import type { ActionRiskLevel } from "./ai-policy";
import type { IntegrationActionId } from "./actions-registry";

/** Who initiated an integration action. */
export type IntegrationActionSource =
  | "human"
  | "ai"
  | "automation"
  | "api"
  | "live_agent";

/** Active voice agent runtime principal — authorized by published AgentVersion. */
export type LiveAgentExecutionContext = {
  actorType: "agent_runtime";
  agentId: string;
  agentVersionId?: string | null;
  callId?: string | null;
};

/**
 * Appointment operations a live Caller Amy may perform during an active call
 * under the owner-approved published configuration — no per-call owner approval.
 */
export const LIVE_AGENT_APPOINTMENT_ACTIONS = new Set<IntegrationActionId | string>([
  "appointment.list_available_times",
  "appointment.book",
  "appointment.retrieve",
  "appointment.get_scheduling_link",
  "appointment.get_cancel_url",
  "appointment.get_reschedule_url",
]);

export function isLiveAgentAppointmentAction(actionId: string): boolean {
  return LIVE_AGENT_APPOINTMENT_ACTIONS.has(actionId);
}

export function liveAgentAllowsAction(
  actionId: string,
  riskLevel: ActionRiskLevel,
): boolean {
  if (isLiveAgentAppointmentAction(actionId)) return true;
  // Defensive: read-only appointment lookups during a live call.
  if (riskLevel === 1 && actionId.startsWith("appointment.")) return true;
  return false;
}

export function summarizeLiveAgentContext(ctx: LiveAgentExecutionContext): Record<string, unknown> {
  return {
    actorType: ctx.actorType,
    agentId: ctx.agentId,
    agentVersionId: ctx.agentVersionId || null,
    callId: ctx.callId || null,
  };
}
