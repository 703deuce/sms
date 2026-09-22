import type { VoiceV3AgentConfig } from "../config/agent-config";
import { searchKnowledge } from "@/lib/voice/knowledge-processor";
import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";

export type SearchBusinessKnowledgeResult =
  | {
      status: "FOUND";
      answerContext: string;
      sources: Array<{ sourceId: string; title?: string; url?: string }>;
    }
  | { status: "NO_MATCH" }
  | { status: "UNAVAILABLE"; recovery: "USE_HOT_CONTEXT_OR_TAKE_MESSAGE" };

export async function executeSearchBusinessKnowledge(input: {
  workspaceId: string;
  agentId: string;
  config: VoiceV3AgentConfig;
  query: string;
}): Promise<SearchBusinessKnowledgeResult> {
  const retrieval = input.config.knowledge?.retrieval;
  if (!retrieval?.enabled) {
    return { status: "UNAVAILABLE", recovery: "USE_HOT_CONTEXT_OR_TAKE_MESSAGE" };
  }

  const q = input.query.trim();
  if (!q) {
    return { status: "NO_MATCH" };
  }

  const kbIds = retrieval.knowledgeBaseIds?.filter(Boolean) ?? [];
  if (kbIds.length) {
    const hits: Array<{ sourceId: string; title?: string; snippet: string }> = [];
    for (const kbId of kbIds.slice(0, 3)) {
      const rows = await searchKnowledge(input.workspaceId, kbId, q);
      for (const row of rows.slice(0, 5)) {
        hits.push({
          sourceId: row.sourceId,
          title: row.name,
          snippet: row.snippet,
        });
      }
    }
    if (hits.length) {
      const answerContext = hits
        .slice(0, 3)
        .map((h) => h.snippet.trim())
        .filter(Boolean)
        .join("\n\n");
      return {
        status: "FOUND",
        answerContext,
        sources: hits.slice(0, 3).map((h) => ({
          sourceId: h.sourceId,
          title: h.title,
        })),
      };
    }
  }

  const hot = await resolveBusinessAnswer({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    topic: q,
  });
  if (hot.ok && hot.speak.trim()) {
    return {
      status: "FOUND",
      answerContext: hot.speak.trim(),
      sources: [{ sourceId: "hot_context", title: "Business context" }],
    };
  }

  return { status: "NO_MATCH" };
}
