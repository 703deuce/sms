import type { JobContext } from "@livekit/agents";
import {
  attachObservers,
  buildSessionContext,
  createAgentAndUserData,
  createVoicePipeline,
  loadTenantAndPublishedAgent,
  resolveCall,
  startInboundSession,
} from "./inbound-session-pipeline";

/** Inbound SIP path — LiveKit AgentSession only (no legacy Amy/workflow-engine). */
export async function runInboundEntry(ctx: JobContext): Promise<void> {
  const { identity, explicit } = await resolveCall(ctx);
  const tenant = await loadTenantAndPublishedAgent({ ctx, identity, explicit });
  const sessionBase = buildSessionContext({
    ctx,
    identity,
    routing: tenant.routing,
    callId: tenant.callId,
    agentConfig: tenant.agentConfig,
    loaded: tenant.loaded,
    agentRow: tenant.agentRow,
  });
  const { userData, agent, timezone, businessName } = await createAgentAndUserData({
    ctx,
    sessionBase: { ...sessionBase, timezone: "", businessName: "" },
    routing: tenant.routing,
    callId: tenant.callId,
    agentConfig: tenant.agentConfig,
    loaded: tenant.loaded,
    agentRow: tenant.agentRow,
    identity,
  });
  void timezone;
  void businessName;

  const { session, latencyPipelineKind, latencyTtsConfig } = createVoicePipeline({
    sessionBase,
    agentConfig: tenant.agentConfig,
    routing: tenant.routing,
    callId: tenant.callId,
    agentRow: tenant.agentRow,
    userData,
  });

  attachObservers({
    ctx,
    session,
    callId: tenant.callId,
    routing: tenant.routing,
    latencyPipelineKind,
    latencyTtsConfig,
  });

  await startInboundSession({
    ctx,
    session,
    agent,
    userData,
    outputGainDb: sessionBase.outputGainDb,
  });
}
