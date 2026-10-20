import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "./voice-tool-catalog";

/** Single registry source for OpenAI tool definitions (Phase 3 / 5). */
export function buildVoiceV3AstraFunctionTools(config: VoiceV3AgentConfig): FunctionTool[] {
  return buildVoiceV3AstraFunctionToolsFromCatalog(config);
}
