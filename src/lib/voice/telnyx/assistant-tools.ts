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

  // Phone destinations for human transfer (destination labels ≠ AI Handoff).
  const validTargets = (input.transferTargets || []).filter(
    (t) => t?.name && t?.to && /^\+?[1-9]\d{6,14}$/.test(String(t.to).replace(/[\s()-]/g, "")),
  );
  const escalateEnabled = isBuiltinToolEnabled(enabled, "escalate_human");
  // Prefer a SINGLE transfer path. Offering native Transfer + escalate_human
  // causes a dual-dial race: Telnyx AI reports Transfer failed and the model
  // apologizes while Call Control is still ringing the destination through.
  // Call Control escalate is the reliable PSTN path once Outbound Voice is ready.
  const useCallControlTransfer = escalateEnabled && validTargets.length > 0;

  if (
    isBuiltinToolEnabled(enabled, "transfer") &&
    validTargets.length &&
    !useCallControlTransfer
  ) {
    // Native Telnyx phone Transfer — only when escalate_human is not available.
    const transferBody: Record<string, unknown> = {
      name: "transfer_to_human",
      description:
        "Transfer the live caller to a named human phone destination (cold phone Transfer). Use when the caller asks for a person. This is not AI Assistant Handoff. After invoking, stay quiet — do not claim failure while connecting.",
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
    // This is AI Assistant Handoff (assistant-to-assistant), not phone Transfer.
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
  // accidental hangups.
  const skipEndCall = isBuiltinToolEnabled(enabled, "hangup");
  for (const [key, builtin] of Object.entries(BUILTIN_WEBHOOK_BODIES)) {
    if (!isBuiltinToolEnabled(enabled, key)) continue;
    if (skipEndCall && key === "end_call") continue;
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
    const escalateSolePath = key === "escalate_human" && useCallControlTransfer;
    const description = escalateSolePath
      ? "Transfer the caller to a named human phone destination (e.g. Agent Handoff / Front Desk). This is the ONLY human phone transfer tool. Call it once when they ask for a person. If it returns ok=true, say you are connecting them and stay silent — never say the transfer failed while they are being connected. If it returns ok=false, then apologize and take a message. Never invent a phone number. Never hang up to transfer."
      : `${builtin.description} If this tool fails, do NOT hang up — apologize and offer to take a message.`;
    tools.push({
      type: "webhook",
      webhook: {
        name: builtin.name,
        description,
        url: webhookUrl,
        method: "POST",
        timeout_ms: escalateSolePath ? 12000 : slow ? 10000 : 8000,
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
