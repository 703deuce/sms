import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import { searchBusinessKnowledge } from "./search";

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

  const { matches } = await searchBusinessKnowledge({
    workspaceId: input.workspaceId,
    query: q,
  });

  if (!matches.length) {
    const faq = input.config.business?.faqFacts?.join("\n")?.trim();
    if (faq) {
      return {
        status: "FOUND",
        answerContext: faq.slice(0, 2000),
        sources: [{ sourceId: "faq_facts", title: "FAQ" }],
      };
    }
    return { status: "NO_MATCH" };
  }

  const answerContext = matches
    .slice(0, 3)
    .map((m) => `${m.question}: ${m.answer}`.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    status: "FOUND",
    answerContext,
    sources: matches.slice(0, 3).map((m) => ({
      sourceId: m.sourceId,
      title: m.question,
    })),
  };
}
