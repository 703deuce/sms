/**
 * Republish Amy 866 with Telnyx Conversation Workflow + narrow tool surface.
 * TeXML/Telnyx only — does not enable LiveKit.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/amy-workflow-republish.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { applyHarborDrainProsWizardKnowledge } from "../src/lib/receptionist-wizard/harbor-drain-pros-config";
import {
  AMY_FLUX_PROFILE,
  AMY_MINIMUM_SIDE_EFFECT_MODEL,
} from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  filterToolsForCallerAmyPublish,
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
} from "../src/lib/voice/workflow-engine/tool-publish";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import { restoreTexmlInboundRoute } from "../src/lib/telephony/provisioning/number-assignment";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";

function loadWizard(config: Record<string, unknown>): AppointmentReceptionistWizardState {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const stored = advanced.appointmentReceptionistWizard as
    | Partial<AppointmentReceptionistWizardState>
    | undefined;
  return {
    ...createDefaultWizardState(),
    ...(stored || {}),
  } as AppointmentReceptionistWizardState;
}

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Amy agent ${AMY_AGENT_ID} not found`);

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const wizard = applyHarborDrainProsWizardKnowledge(loadWizard(prev as Record<string, unknown>));
  const draftConfig = buildWizardAgentConfig(wizard);

  const publishedTools = filterToolsForCallerAmyPublish(
    resolveEnabledBuiltinTools({
      enabledBuiltinTools: draftConfig.enabledBuiltinTools,
      agentType: "appointment_booking",
    }),
    draftConfig,
  );

  console.log("=== Amy conversation-workflow republish ===");
  console.log(
    JSON.stringify(
      {
        model: draftConfig.model?.modelId,
        expectedModel: AMY_MINIMUM_SIDE_EFFECT_MODEL,
        sttModel: draftConfig.transcription?.sttModel,
        latencyProfile: draftConfig.voiceTiming?.activeProfile,
        expectedProfile: AMY_FLUX_PROFILE,
        conversationWorkflow: (draftConfig.advanced as Record<string, unknown>)
          ?.conversationWorkflowMode,
        publishedTools,
      },
      null,
      2,
    ),
  );

  if (draftConfig.model?.modelId !== AMY_MINIMUM_SIDE_EFFECT_MODEL) {
    throw new Error(`Model not set to ${AMY_MINIMUM_SIDE_EFFECT_MODEL}`);
  }
  for (const tool of WORKFLOW_PUBLISHED_WEBHOOK_TOOLS) {
    if (!publishedTools.includes(tool)) {
      throw new Error(`Published tools missing ${tool}`);
    }
  }
  for (const retired of ["send_sms", "record_call_fact", "continue_workflow"]) {
    if (publishedTools.includes(retired)) {
      throw new Error(`${retired} should not be published in workflow mode`);
    }
  }

  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, { draftConfig });

  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "conversation-workflow-gpt54mini-flux-balanced",
  );

  if (agent.telnyxAssistantId && ai.isTelnyxAiConfigured()) {
    const remote = await ai.getAssistant(agent.telnyxAssistantId);
    const data = (remote as { data?: Record<string, unknown> }).data || remote;
    const flow = data.conversation_flow as { nodes?: unknown[] } | undefined;
    console.log(
      JSON.stringify(
        {
          liveModel: data.model,
          liveTranscription: (data.transcription as Record<string, unknown> | undefined)?.model,
          toolIds: data.tool_ids,
          workflowNodes: Array.isArray(flow?.nodes) ? flow.nodes.length : null,
        },
        null,
        2,
      ),
    );
    if (!flow?.nodes?.length) {
      console.warn(
        "WARN: Live assistant has no conversation_flow — account may not support workflows; inline fallback may be active.",
      );
    }
  }

  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });
  if (!restored.ok) throw new Error(`TeXML restore failed for ${PHONE_E164}`);

  console.log(
    JSON.stringify(
      {
        version: published.version.version,
        telnyxAssistantId: published.agent.telnyxAssistantId,
        texmlRoute: published.texmlRoute,
      },
      null,
      2,
    ),
  );
  console.log(`\nDone — call ${PHONE_E164} (workflow-scoped tools, GPT-5.4-mini, Flux balanced).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
