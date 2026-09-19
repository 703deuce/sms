#!/usr/bin/env npx tsx
import fs from "node:fs";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { getPrisma } from "../src/lib/db";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { formatBusinessLocalDateTime } from "../src/lib/voice-v3/prompts/business-local-time";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import { buildIntakeObjectiveContext } from "../src/lib/voice-v3/intake-objective/build-intake-context";
import {
  buildAstraBusinessContext,
  formatAstraBusinessContextForThinking,
} from "../src/lib/voice-v3/agent/astra-business-context";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";

const AGENT = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const WS = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT, workspaceId: WS },
  });
  if (!agent?.publishedVersionId) throw new Error("agent missing published version");

  const v3 = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WS,
    agentId: AGENT,
    publishedVersionId: agent.publishedVersionId,
  });
  const tz = v3.timezone || "America/New_York";
  const prompts = buildVoiceV3Prompts({
    agentConfig: v3,
    businessName: v3.businessName,
    timezone: tz,
    currentLocalDateTime: formatBusinessLocalDateTime(tz, new Date()),
    toolNames: [],
  });
  const tools = buildVoiceV3AstraFunctionTools(v3);
  const rc = tools.find((t) => t.name === "request_callback");
  const ctx = createInitialVoiceV3CallContext({
    callId: "forensic",
    liveSessionId: "forensic",
    workspaceId: WS,
    tenantId: WS,
    inboundCallerE164: "+15551234567",
  });
  const intakeAtStart = buildIntakeObjectiveContext(v3, ctx);
  const biz = formatAstraBusinessContextForThinking(buildAstraBusinessContext(ctx, v3));

  const out = {
    workspaceId: WS,
    agentId: AGENT,
    publishedVersionId: agent.publishedVersionId,
    config_version: v3.configVersion,
    deployed_commit_sha: process.env.DEPLOYED_COMMIT_SHA ?? null,
    operationRequirements: v3.operationRequirements,
    callHandling: v3.callHandling,
    intake_fields: v3.intakeFields.map((f) => ({
      key: f.key,
      label: f.label,
      required: f.required,
    })),
    request_callback_tool: {
      description: rc?.description ?? null,
      parameters: rc?.parameters ?? null,
    },
    astra_instructions_hash_source: "buildVoiceV3Prompts @ current repo + published wizard",
    astra_char_count: prompts.astraInstructions.length,
    amy_char_count: prompts.liveInstructions.length,
    intake_objective_at_call_start: intakeAtStart,
    astra_business_context_at_call_start: biz,
    amy_contains_callback_word: /\bcallback\b/i.test(prompts.liveInstructions),
    astra_contains_callback_word: /\bcallback\b/i.test(prompts.astraInstructions),
    cross_tool_contains_callback: /callback/i.test(prompts.astraInstructions),
  };

  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync(
    "/opt/cursor/artifacts/voice-v3-callback-effective-contract-ws1.json",
    JSON.stringify(out, null, 2),
  );
  fs.writeFileSync(
    "/opt/cursor/artifacts/voice-v3-callback-amy-instructions-ws1.md",
    prompts.liveInstructions,
  );
  fs.writeFileSync(
    "/opt/cursor/artifacts/voice-v3-callback-astra-instructions-ws1.md",
    prompts.astraInstructions,
  );
  console.log("DUMP_OK", JSON.stringify({ amy: out.amy_char_count, astra: out.astra_char_count }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
