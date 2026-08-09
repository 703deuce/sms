#!/usr/bin/env node
/**
 * Activate the home_service_dispatcher master receptionist workflow on Amy.
 *
 *   npx tsx scripts/activate-home-service-dispatcher.mjs
 *
 * Env:
 *   WORKSPACE_ID (default ws_1)
 *   AMY_AGENT_ID (default cmshz2lc25c622c4i58303501)
 *   VOICE_TRANSFER_FALLBACK_E164 — on-call transfer destination for emergencies
 */
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();

async function main() {
  const { persistVoiceWorkflowDefinition } = await import(
    "../src/lib/voice/workflow-runtime/persistence.ts"
  );
  const { publishVoiceAgent } = await import("../src/lib/voice/agent-service.ts");
  const { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } = await import(
    "../src/lib/voice/workflow-runtime/definitions/home-service-dispatcher.ts"
  );
  const { setActiveWorkflowForAgent } = await import(
    "../src/lib/voice/workflow-runtime/loader.ts"
  );

  const transferDest = process.env.VOICE_TRANSFER_FALLBACK_E164?.trim();
  const definition = {
    ...HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    metadata: {
      ...HOME_SERVICE_DISPATCHER_WORKFLOW_V1.metadata,
      ...(transferDest ? { transferDestination: transferDest } : {}),
    },
  };

  console.log("\n=== 1) Persist home_service_dispatcher workflow ===");
  const ref = await persistVoiceWorkflowDefinition({
    workspaceId: WORKSPACE_ID,
    agentId: AMY_AGENT_ID,
    definition,
    setActive: true,
  });
  setActiveWorkflowForAgent(AMY_AGENT_ID, ref);
  console.log({ workflowId: ref.workflowId, version: ref.version });

  console.log("\n=== 2) Publish Amy agent ===");
  const published = await publishVoiceAgent(WORKSPACE_ID, AMY_AGENT_ID, "activate-home-service-dispatcher");
  console.log({
    agent: published.agent.name,
    status: published.agent.status,
    publishedVersionId: published.agent.publishedVersionId,
    phoneNumberId: published.agent.phoneNumberId,
  });

  console.log("\n=== READY ===");
  console.log(
    JSON.stringify(
      {
        agentId: AMY_AGENT_ID,
        workflow: ref,
        transferDestination: transferDest || definition.metadata?.transferDestination,
        voiceRuntimeEnv: "Set VOICE_ACTIVE_WORKFLOW=home_service_dispatcher:1 on transovo-voice-runtime if not using DB publish",
        call: "+18663464256",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
