/**
 * Build Telnyx AI Assistant tool definitions (retrieval + webhooks + telephony).
 * Only attaches tools explicitly enabled for the agent (plus knowledge retrieval).
 *
 * Native Telnyx tools (transfer / hangup / handoff / sip_refer / send_dtmf) must
 * stay native — never serialize them as webhook tools.
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

const HANGUP_DESCRIPTION =
  "End the call ONLY after the caller clearly says goodbye and the conversation is fully finished. " +
  "NEVER use hangup to transfer, connect a human, look up CRM, send SMS, or recover from a tool error. " +
  "NEVER use hangup immediately after another tool. If unsure, keep talking or take a message.";

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

  // Native transfer FIRST — human handoff must not compete with hangup/handoff.
  const validTargets = (input.transferTargets || []).filter(
    (t) => t?.name && t?.to && /^\+?[1-9]\d{6,14}$/.test(String(t.to).replace(/[\s()-]/g, "")),
  );
  if (isBuiltinToolEnabled(enabled, "transfer") && validTargets.length) {
    const transferBody: Record<string, unknown> = {
      targets: validTargets.map((t) => ({
        name: t.name,
        to: t.to.startsWith("+") ? t.to : `+${t.to.replace(/\D/g, "")}`,
      })),
    };
    // Cold transfer by default. Warm hold tears down the AI mid-call.
    if (input.warmTransferInstructions?.trim()) {
      transferBody.warm_transfer_instructions = input.warmTransferInstructions.trim();
    }
    tools.push({
      type: "transfer",
      transfer: transferBody,
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
        max_handoffs: 2,
      },
    });
  }

  const base = getAppBaseUrl();
  const webhookUrl = `${base}/api/telnyx/voice/tools`;
  if (!base || base.includes("localhost")) {
    console.warn(
      "[assistant-tools] APP_URL looks wrong for Telnyx webhooks:",
      base,
    );
  }

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
          `Execute the ${tool.toolType} business action. Never claim success until this tool returns ok=true. Never hang up if this tool fails.`,
        url: webhookUrl,
        method: "POST",
        timeout_ms: 10000,
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
            notes: { type: "string", description: "Optional notes from the conversation" },
          },
          required: Array.isArray(schema.required) ? schema.required : [],
        },
      },
    });
  }

  // Attach only explicitly enabled Transovo builtins (never the full catalog).
  // Skip end_call when native hangup is already enabled — dual terminators cause
  // accidental hangups. Skip escalate_human when native transfer is attached —
  // competing transfer paths caused the model to hang up instead.
  const hasNativeTransfer = tools.some((t) => (t as { type?: string }).type === "transfer");
  const skipEndCall = isBuiltinToolEnabled(enabled, "hangup");
  for (const [key, builtin] of Object.entries(BUILTIN_WEBHOOK_BODIES)) {
    if (!isBuiltinToolEnabled(enabled, key)) continue;
    if (skipEndCall && key === "end_call") continue;
    if (hasNativeTransfer && key === "escalate_human") continue;
    if (tools.some((t) => (t as { webhook?: { name?: string } }).webhook?.name === builtin.name)) {
      continue;
    }
    const slow =
      key.includes("crm") ||
      key === "lookup_customer" ||
      key === "search_crm_contacts" ||
      key === "send_sms" ||
      key === "book_appointment" ||
      key === "calendar_availability";
    tools.push({
      type: "webhook",
      webhook: {
        name: builtin.name,
        description: `${builtin.description} If this tool fails, do NOT hang up — apologize and offer to take a message.`,
        url: webhookUrl,
        method: "POST",
        timeout_ms: slow ? 10000 : 8000,
        headers: [
          { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
          { name: "X-Transovo-Agent-Id", value: input.agentId },
          { name: "X-Transovo-Tool-Type", value: builtin.toolType },
        ],
        body_parameters: builtin.body,
      },
    });
  }

  // Alias: models often invent "crm_lookup" — map it to the same gateway.
  if (
    isBuiltinToolEnabled(enabled, "search_crm_contacts") &&
    !tools.some((t) => (t as { webhook?: { name?: string } }).webhook?.name === "crm_lookup")
  ) {
    const body = BUILTIN_WEBHOOK_BODIES.search_crm_contacts;
    tools.push({
      type: "webhook",
      webhook: {
        name: "crm_lookup",
        description:
          "Alias for search_crm_contacts. Look up a contact by name/phone/email. Never hang up after this tool.",
        url: webhookUrl,
        method: "POST",
        timeout_ms: 10000,
        headers: [
          { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
          { name: "X-Transovo-Agent-Id", value: input.agentId },
          { name: "X-Transovo-Tool-Type", value: "search_crm_contacts" },
        ],
        body_parameters: body.body,
      },
    });
  }

  // Hangup LAST and only when enabled — ordering matters for model tool choice.
  if (isBuiltinToolEnabled(enabled, "hangup")) {
    tools.push({
      type: "hangup",
      hangup: {
        description: HANGUP_DESCRIPTION,
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
