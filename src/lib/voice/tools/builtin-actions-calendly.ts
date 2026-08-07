import { resolveLiveAgentExecutionContext } from "./live-agent-context";

export async function executeLiveAgentCalendlyAction(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  actionId: "appointment.list_available_times" | "appointment.book";
  params: Record<string, unknown>;
  contactId?: string | null;
}) {
  const liveAgent = await resolveLiveAgentExecutionContext({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });
  const { executeIntegrationAction } = await import(
    "@/lib/integrations/framework/actions-registry"
  );
  return executeIntegrationAction({
    workspaceId: input.workspaceId,
    provider: "calendly",
    actionId: input.actionId,
    params: input.params,
    contactId: input.contactId || null,
    actorUserId: null,
    source: "live_agent",
    liveAgent,
  });
}
