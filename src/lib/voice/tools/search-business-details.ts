/**
 * search_business_details — long-tail / detailed knowledge lookup.
 * Not for basic FAQ covered in the base prompt.
 */

import { resolveBusinessAnswer } from "@/lib/voice/knowledge/resolve-business-answer";
import {
  workflowToolResponse,
  type WorkflowToolResponse,
} from "@/lib/voice/tools/workflow-tool-contract";

export async function executeSearchBusinessDetails(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  query: string;
}): Promise<WorkflowToolResponse> {
  const query = input.query?.trim();
  if (!query || query.length < 4) {
    return workflowToolResponse({
      status: "invalid_input",
      result: "query_too_short",
      speak: "What specific detail would you like me to look up?",
    });
  }

  if (!input.agentId) {
    return workflowToolResponse({
      status: "temporarily_unavailable",
      result: "agent_context_missing",
      speak: "I'm having trouble looking that up right now.",
    });
  }

  try {
    const answer = await resolveBusinessAnswer({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      topic: query,
    });
    if (answer.ok) {
      const speak = answer.speak.slice(0, 1200);
      return workflowToolResponse({
        status: "success",
        result: "details_found",
        speak,
      });
    }
    return workflowToolResponse({
      status: "not_found",
      result: answer.code || "details_not_found",
      speak:
        answer.speak ||
        "I don't have that specific detail on hand. I can take a message and have someone follow up.",
    });
  } catch {
    return workflowToolResponse({
      status: "temporarily_unavailable",
      result: "lookup_failed",
      speak: "I'm having trouble pulling that up right now. Want me to have someone call you back?",
    });
  }
}
