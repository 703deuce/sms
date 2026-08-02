/**
 * Build Telnyx AI Assistant tool definitions (retrieval + webhooks + telephony).
 * Only attaches tools explicitly enabled for the agent (plus knowledge retrieval).
 */

import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { retrievalToolForBuckets } from "./rag";
import {
  BUILTIN_WEBHOOK_BODIES,
  isBuiltinToolEnabled,
  resolveEnabledBuiltinTools,
} from "@/lib/voice/tools/catalog";

type ToolRow = {
  id: string;
  name: string;
  description: string | null;
  toolType: string;
  config: unknown;
  inputSchema: unknown;
};

export function buildAssistantTools(input: {
  workspaceId: string;
  agentId: string;
  bucketIds: string[];
  tools: ToolRow[];
  transferTargets?: Array<{ name: string; to: string }>;
  handoffAssistants?: Array<{ name: string; id: string }>;
  warmTransferInstructions?: string;
  /** Catalog keys enabled for this agent. */
  enabledBuiltinTools?: string[];
  agentType?: string | null;
}) {
  const enabled = resolveEnabledBuiltinTools({
    enabledBuiltinTools: input.enabledBuiltinTools,
    agentType: input.agentType,
  });

  const tools: Record<string, unknown>[] = [];
  const retrieval = retrievalToolForBuckets(input.bucketIds);
  if (retrieval) tools.push(retrieval);

  if (isBuiltinToolEnabled(enabled, "hangup")) {
    tools.push({
      type: "hangup",
      hangup: {
        description:
          "End the call when the conversation is complete or the caller asks to hang up. Give a brief closing statement first unless emergency termination is required.",
      },
    });
  }

  if (
    isBuiltinToolEnabled(enabled, "transfer") &&
    input.transferTargets?.length
  ) {
    tools.push({
      type: "transfer",
      transfer: {
        targets: input.transferTargets.map((t) => ({
          name: t.name,
          to: t.to,
        })),
        warm_transfer_instructions:
          input.warmTransferInstructions ||
          "Briefly introduce the caller and summarize why they are calling before connecting.",
      },
    });
  }

  if (
    isBuiltinToolEnabled(enabled, "handoff") &&
    input.handoffAssistants?.length
  ) {
    // Cap specialists to reduce handoff loops; Telnyx keeps conversation context.
    const assistants = input.handoffAssistants.slice(0, 6).map((a) => ({
      name: a.name,
      id: a.id,
    }));
    tools.push({
      type: "handoff",
      handoff: {
        ai_assistants: assistants,
        max_handoffs: 3,
      },
    });
  }

  const base = getAppBaseUrl();
  const webhookUrl = `${base}/api/telnyx/voice/tools`;

  for (const tool of input.tools) {
    const schema =
      (tool.inputSchema as Record<string, unknown> | null) ||
      defaultBodySchema(tool.toolType);

    tools.push({
      type: "webhook",
      webhook: {
        name: sanitizeToolName(tool.name || tool.toolType),
        description:
          tool.description ||
          `Execute the ${tool.toolType} business action. Never claim success until this tool returns ok=true.`,
        url: webhookUrl,
        method: "POST",
        headers: [
          { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
          { name: "X-Transovo-Agent-Id", value: input.agentId },
          { name: "X-Transovo-Tool-Id", value: tool.id },
          { name: "X-Transovo-Tool-Type", value: tool.toolType },
        ],
        body_parameters: {
          type: "object",
          properties: {
            ...(schema.properties as Record<string, unknown> | undefined),
            call_control_id: {
              type: "string",
              description: "Telnyx call control id when available",
            },
            notes: { type: "string", description: "Optional notes from the conversation" },
          },
          required: Array.isArray(schema.required) ? schema.required : [],
        },
      },
    });
  }

  // Attach only explicitly enabled Transovo builtins (never the full catalog).
  for (const [key, builtin] of Object.entries(BUILTIN_WEBHOOK_BODIES)) {
    if (!isBuiltinToolEnabled(enabled, key)) continue;
    if (tools.some((t) => (t as { webhook?: { name?: string } }).webhook?.name === builtin.name)) {
      continue;
    }
    tools.push({
      type: "webhook",
      webhook: {
        name: builtin.name,
        description: builtin.description,
        url: webhookUrl,
        method: "POST",
        headers: [
          { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
          { name: "X-Transovo-Agent-Id", value: input.agentId },
          { name: "X-Transovo-Tool-Type", value: builtin.toolType },
        ],
        body_parameters: builtin.body,
      },
    });
  }

  return tools;
}

function sanitizeToolName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "business_tool";
}

function defaultBodySchema(toolType: string): Record<string, unknown> {
  switch (toolType) {
    case "send_sms":
      return {
        properties: {
          to: { type: "string", description: "E.164 phone number" },
          body: { type: "string", description: "SMS message body" },
        },
        required: ["to", "body"],
      };
    case "book_appointment":
      return {
        properties: {
          startAt: { type: "string", description: "ISO start time" },
          serviceId: { type: "string" },
          staffId: { type: "string" },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          customerEmail: { type: "string" },
        },
        required: ["startAt", "customerPhone"],
      };
    case "transfer_call":
    case "warm_transfer":
    case "cold_transfer":
      return {
        properties: {
          to: { type: "string", description: "Transfer destination E.164 or extension" },
          mode: { type: "string", description: "cold or warm" },
        },
        required: ["to"],
      };
    default:
      return {
        properties: {
          payload: { type: "object", description: "Tool payload" },
        },
        required: [],
      };
  }
}
