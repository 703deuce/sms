/**
 * Switch Amy (866) LLM to OpenAI via Telnyx BYOK (openai_key).
 *
 * Note: Telnyx AI Assistants reject openai/gpt-4o-mini (error 10027).
 * Default is openai/gpt-5.4-mini — the supported OpenAI mini on this stack.
 * Override: AMY_LLM_MODEL=openai/gpt-4o (also BYOK-supported).
 * Keeps TeXML ingress + ElevenLabs Jessica voice; only changes the model.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-amy-openai-4o-mini.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import {
  OPENAI_API_KEY_REF,
  assistantModelFields,
  verifyIntegrationSecret,
} from "../src/lib/voice/telnyx/official-baseline";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";
const MODEL_ID = process.env.AMY_LLM_MODEL || "openai/gpt-5.4-mini";

async function main() {
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const secret = await verifyIntegrationSecret(OPENAI_API_KEY_REF);
  if (!secret.exists) {
    throw new Error(
      `Telnyx integration secret "${OPENAI_API_KEY_REF}" missing — add OPENAI_API_KEY to Mission Control integration secrets`,
    );
  }
  console.log(secret.message);

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent?.telnyxAssistantId) {
    throw new Error("Amy agent or telnyxAssistantId not found");
  }

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const prevModel = prev.model?.modelId;

  const modelPatch = assistantModelFields(MODEL_ID, {
    openaiKeyRef: OPENAI_API_KEY_REF,
  });
  console.log("\n=== Target model ===");
  console.log(
    JSON.stringify(
      {
        agent: agent.name,
        phone: PHONE_E164,
        telnyxAssistantId: agent.telnyxAssistantId,
        ...modelPatch,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Preflight patch on Telnyx assistant ===");
  await ai.updateAssistant(agent.telnyxAssistantId, modelPatch);
  const preflight = await ai.getAssistant(agent.telnyxAssistantId);
  const preData = (preflight as { data?: Record<string, unknown> }).data || preflight;
  const liveModel = String((preData as Record<string, unknown>).model || "");
  const liveKeyRef = (preData as Record<string, unknown>).llm_api_key_ref;
  if (liveModel !== MODEL_ID) {
    throw new Error(`Telnyx rejected model — live="${liveModel}" wanted="${MODEL_ID}"`);
  }
  console.log(
    JSON.stringify({ model: liveModel, llm_api_key_ref: liveKeyRef }, null, 2),
  );

  console.log("\n=== Save draft model ===");
  const nextDraft = {
    ...prev,
    model: {
      ...(prev.model || {}),
      provider: "openai",
      modelId: MODEL_ID,
      customApiKeyRef: OPENAI_API_KEY_REF,
      temperature: prev.model?.temperature ?? 0.4,
      maxTokens: prev.model?.maxTokens ?? 1024,
    },
  };
  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, { draftConfig: nextDraft });
  console.log(`draft model: ${prevModel} → ${MODEL_ID}`);

  console.log("\n=== Publish (config version + Telnyx sync) ===");
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "switch-openai-4o-mini",
  );

  console.log("\n=== Ensure TeXML inbound (not LiveKit) ===");
  const { restoreTexmlInboundRoute } = await import(
    "../src/lib/telephony/provisioning/number-assignment"
  );
  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });
  if (!restored.ok) {
    throw new Error(`TeXML restore failed for ${PHONE_E164}`);
  }

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": PHONE_E164 } },
  );
  const pn = listed.data?.[0];
  const remote = await ai.getAssistant(agent.telnyxAssistantId);
  const data = (remote as { data?: Record<string, unknown> }).data || remote;

  console.log(
    JSON.stringify(
      {
        version: published.version.version,
        connection_name: pn?.connection_name,
        model: (data as Record<string, unknown>).model,
        llm_api_key_ref: (data as Record<string, unknown>).llm_api_key_ref,
        voice: (
          ((data as Record<string, unknown>).voice_settings || {}) as Record<
            string,
            unknown
          >
        ).voice,
        texmlRoute: restored.texmlRoute?.path,
      },
      null,
      2,
    ),
  );

  console.log(`\nDone. Call ${PHONE_E164} — Amy uses ${MODEL_ID} (OpenAI BYOK).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
