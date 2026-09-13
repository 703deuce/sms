/**
 * Single canonical tool schemas — same bodies Telnyx shared tools use.
 */
import { BUILTIN_WEBHOOK_BODIES } from "@/lib/voice/tools/catalog";
import { WORKFLOW_PUBLISHED_WEBHOOK_TOOLS } from "@/lib/voice/workflow-engine/tool-publish";
import type { OpenAiFunctionTool } from "@/lib/voice/testing/openai-tool-chat";

function catalogBodyToOpenAi(toolType: string): OpenAiFunctionTool {
  const entry = BUILTIN_WEBHOOK_BODIES[toolType as keyof typeof BUILTIN_WEBHOOK_BODIES];
  if (!entry?.body) {
    throw new Error(`Missing canonical webhook body for ${toolType}`);
  }
  const body = entry.body as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return {
    name: toolType,
    description: entry.description || toolType,
    parameters: {
      type: "object",
      properties: body.properties || {},
      required: body.required || [],
      additionalProperties: false,
    },
  };
}

export function openAiToolsForConversationWorkflow(): OpenAiFunctionTool[] {
  return WORKFLOW_PUBLISHED_WEBHOOK_TOOLS.map((t) => catalogBodyToOpenAi(t));
}

export function assertTelnyxRegistrationConformance(): string[] {
  const errors: string[] = [];
  for (const toolType of WORKFLOW_PUBLISHED_WEBHOOK_TOOLS) {
    const entry = BUILTIN_WEBHOOK_BODIES[toolType as keyof typeof BUILTIN_WEBHOOK_BODIES];
    if (!entry?.body) errors.push(`${toolType}: missing body`);
    if (!entry?.toolType) errors.push(`${toolType}: missing toolType`);
    const body = entry?.body as { required?: string[] };
    if (toolType === "send_resource" && !body.required?.includes("resource_type")) {
      errors.push("send_resource: resource_type must be required");
    }
  }
  return errors;
}
