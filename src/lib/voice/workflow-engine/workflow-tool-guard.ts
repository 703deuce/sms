/**
 * Final-layer authorization for Telnyx workflow-scoped tools.
 */

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  isConversationWorkflowMode,
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
} from "@/lib/voice/workflow-engine/tool-publish";

const WORKFLOW_ALLOWED = new Set<string>(WORKFLOW_PUBLISHED_WEBHOOK_TOOLS);

export async function assertWorkflowToolAllowed(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  toolType: string;
}): Promise<{
  allowed: boolean;
  error_code?: string;
  speak?: string;
}> {
  if (!WORKFLOW_ALLOWED.has(input.toolType)) {
    return {
      allowed: false,
      error_code: "TOOL_NOT_PUBLISHED",
      speak: "That action isn't available on this line.",
    };
  }

  if (!input.agentId) {
    return { allowed: true };
  }

  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true },
  });
  const config = agent ? parseVoiceAgentConfig(agent.draftConfig) : null;
  if (!isConversationWorkflowMode(config)) {
    return { allowed: true };
  }

  return { allowed: true };
}
