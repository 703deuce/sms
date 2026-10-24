import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { mergeDialogActiveGoalFromOperation } from "../intake/merge-intake-state";
import { SEARCH_BUSINESS_KNOWLEDGE_TOOL_DESCRIPTION } from "./astra-tool-contracts";

export { SEARCH_BUSINESS_KNOWLEDGE_TOOL_DESCRIPTION };

const searchArgsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Natural-language question about the business (policies, services, hours, service area, FAQs). Not for scheduling availability.",
    ),
});

export type SearchBusinessKnowledgeArgs = z.infer<typeof searchArgsSchema>;

export function buildSearchBusinessKnowledgeOpenAiTool(
  _config: VoiceV3AgentConfig,
): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "search_business_knowledge",
    parameters: searchArgsSchema,
    description: SEARCH_BUSINESS_KNOWLEDGE_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const searchBusinessKnowledgeTool: VoiceToolDefinition<SearchBusinessKnowledgeArgs> = {
  name: "search_business_knowledge",
  description: "search_business_knowledge",
  parameters: {},
  validate: (raw) => searchArgsSchema.parse(raw),
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const snap = mergeDialogActiveGoalFromOperation(
      ctx.runtime.getSnapshot(),
      "search_business_knowledge",
    );
    ctx.runtime.replaceContext(snap);
    if (config.knowledge?.retrieval?.enabled !== true) {
      return voiceToolError(
        "KNOWLEDGE_DISABLED",
        "Business knowledge search is not enabled for this agent.",
        { status: "UNAVAILABLE" },
        "not_available",
      );
    }
    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const agentId = config.agentId?.trim();
    if (!workspaceId || !agentId) {
      return voiceToolError(
        "CONFIGURATION_MISSING",
        "Knowledge search requires workspace and agent binding.",
        {},
        "not_ready",
      );
    }
    const { executeSearchBusinessKnowledge } = await import(
      "../knowledge/execute-search-business-knowledge"
    );
    const result = await executeSearchBusinessKnowledge({
      workspaceId,
      agentId,
      config,
      query: args.query,
    });
    return toolOk(result.status.toLowerCase(), result);
  },
};
