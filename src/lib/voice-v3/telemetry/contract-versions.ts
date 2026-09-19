import { createHash } from "node:crypto";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { VOICE_TOOL_CATALOG, buildVoiceV3AstraFunctionToolsFromCatalog } from "../tools/voice-tool-catalog";
import { buildAstraBackendInstructions } from "../prompts/astra-backend-instructions";
import { buildLiveFrontendInstructions } from "../prompts/live-frontend-instructions";

const PROMPT_VERSION = "voice-v3-prompts-v2";
const ASTRA_PROMPT_VERSION = "voice-v3-astra-v2";
const LIVE_PROMPT_VERSION = "voice-v3-live-v2";

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

export function resolveVoiceV3ContractVersions(config: VoiceV3AgentConfig): {
  live_prompt_version: string;
  astra_prompt_version: string;
  tool_contract_version: string;
  agent_config_version: string;
  deployed_commit_sha: string | null;
  live_model: string;
  backend_model: string;
} {
  const tools = buildVoiceV3AstraFunctionToolsFromCatalog(config).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    strict: t.strict,
  }));

  return {
    live_prompt_version: LIVE_PROMPT_VERSION,
    astra_prompt_version: ASTRA_PROMPT_VERSION,
    tool_contract_version: sha256Canonical({
      catalog: VOICE_TOOL_CATALOG.map((e) => e.name),
      tools,
    }),
    agent_config_version: sha256Canonical({
      intake: config.intakeFields.map((f) => f.key),
      service: config.service.id,
      timezone: config.timezone,
    }),
    deployed_commit_sha: process.env.SOURCE_COMMIT?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
    live_model: process.env.VOICE_V3_BASIC_LIVE_MODEL?.trim() || "gpt-live-1",
    backend_model: "gpt-6-astra",
  };
}

export function logVoiceV3ContractVersions(config: VoiceV3AgentConfig, callId?: string): void {
  const v = resolveVoiceV3ContractVersions(config);
  console.log("VOICE_V3_CONTRACT_VERSIONS", {
    call_id: callId ?? null,
    ...v,
    prompt_bundle: PROMPT_VERSION,
    live_instructions_hash: sha256Canonical(buildLiveFrontendInstructions({})),
    astra_instructions_hash: sha256Canonical(
      buildAstraBackendInstructions({ businessName: config.businessName, timezone: config.timezone }),
    ),
  });
}
