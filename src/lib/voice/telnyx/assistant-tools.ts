/**
 * Build Telnyx AI Assistant tool definitions (retrieval + webhooks + telephony).
 */

import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { retrievalToolForBuckets } from "./rag";

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
}) {
  const tools: Record<string, unknown>[] = [];
  const retrieval = retrievalToolForBuckets(input.bucketIds);
  if (retrieval) tools.push(retrieval);

  tools.push({
    type: "hangup",
    hangup: {
      description: "End the call when the conversation is complete or the caller asks to hang up.",
    },
  });

  if (input.transferTargets?.length) {
    tools.push({
      type: "transfer",
      transfer: {
        targets: input.transferTargets.map((t) => ({
          name: t.name,
          to: t.to,
        })),
        from: undefined,
        warm_transfer_instructions:
          input.warmTransferInstructions ||
          "Briefly introduce the caller and summarize why they are calling before connecting.",
      },
    });
  }

  if (input.handoffAssistants?.length) {
    tools.push({
      type: "handoff",
      handoff: {
        ai_assistants: input.handoffAssistants.map((a) => ({
          name: a.name,
          id: a.id,
        })),
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

  // Built-in booking / contact helpers always available as webhooks.
  for (const builtin of BUILTIN_WEBHOOK_TOOLS) {
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

const BUILTIN_WEBHOOK_TOOLS = [
  {
    name: "lookup_customer",
    toolType: "lookup_customer",
    description: "Look up a contact by phone or email and return CRM context.",
    body: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "update_contact_tags",
    toolType: "update_contact_tags",
    description: "Add or remove tags on a contact.",
    body: {
      type: "object",
      properties: {
        phone: { type: "string" },
        addTags: { type: "array", items: { type: "string" } },
        removeTags: { type: "array", items: { type: "string" } },
      },
      required: ["phone"],
    },
  },
  {
    name: "create_task",
    toolType: "create_task",
    description: "Create a follow-up task for the team.",
    body: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueAt: { type: "string" },
        notes: { type: "string" },
        phone: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "send_email",
    toolType: "send_email",
    description: "Send an email follow-up to the caller or contact.",
    body: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "calendar_availability",
    toolType: "calendar_availability",
    description: "Check live calendar availability before offering times.",
    body: {
      type: "object",
      properties: {
        serviceId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "book_appointment",
    toolType: "book_appointment",
    description:
      "Book an appointment. NEVER tell the caller they are booked until this returns success.",
    body: {
      type: "object",
      properties: {
        startAt: { type: "string" },
        serviceId: { type: "string" },
        staffId: { type: "string" },
        customerName: { type: "string" },
        customerPhone: { type: "string" },
        customerEmail: { type: "string" },
      },
      required: ["startAt", "customerPhone"],
    },
  },
  {
    name: "reschedule_appointment",
    toolType: "reschedule_appointment",
    description: "Reschedule an existing appointment.",
    body: {
      type: "object",
      properties: {
        appointmentId: { type: "string" },
        newStartAt: { type: "string" },
      },
      required: ["appointmentId", "newStartAt"],
    },
  },
  {
    name: "cancel_appointment",
    toolType: "cancel_appointment",
    description: "Cancel an existing appointment.",
    body: {
      type: "object",
      properties: {
        appointmentId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["appointmentId"],
    },
  },
  {
    name: "send_sms",
    toolType: "send_sms",
    description: "Send an SMS to the caller or another number.",
    body: {
      type: "object",
      properties: {
        to: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "body"],
    },
  },
];
