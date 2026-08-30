/**
 * Telnyx shared tools library — create/reuse org-level tools for workflows.
 */

import * as ai from "./ai-client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { strictWebhookBodyParameters } from "@/lib/voice/schema/strict-tool-schema";

export type TransovoSharedToolSet = {
  sendResourceId: string | null;
  searchDetailsId: string | null;
  hangupId: string | null;
  transferId: string | null;
};

const TOOL_DISPLAY_NAMES = {
  sendResource: "transovo-send-resource",
  searchDetails: "transovo-search-business-details",
  hangup: "transovo-hangup",
  transfer: "transovo-transfer",
} as const;

function unwrapToolId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const obj = res as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  const data = obj.data;
  if (data && typeof data === "object" && typeof (data as { id?: string }).id === "string") {
    return (data as { id: string }).id;
  }
  return null;
}

async function listSharedTools(): Promise<Array<{ id: string; display_name?: string }>> {
  const res = await ai.listSharedTools();
  const data = (res as { data?: unknown[] }).data;
  if (Array.isArray(data)) {
    return data as Array<{ id: string; display_name?: string }>;
  }
  if (Array.isArray(res)) return res as Array<{ id: string; display_name?: string }>;
  return [];
}

async function findToolByDisplayName(displayName: string): Promise<string | null> {
  const tools = await listSharedTools();
  const hit = tools.find((t) => t.display_name === displayName);
  return hit?.id || null;
}

function webhookToolBody(input: {
  name: string;
  description: string;
  url: string;
  workspaceId: string;
  agentId: string;
  toolType: string;
  bodyParameters: Record<string, unknown>;
}) {
  return {
    type: "webhook",
    display_name: input.name,
    webhook: {
      name: input.name.replace(/^transovo-/, "").replace(/-/g, "_"),
      description: input.description,
      url: input.url,
      method: "POST",
      timeout_ms: 12000,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
        { name: "X-Transovo-Agent-Id", value: input.agentId },
        { name: "X-Transovo-Tool-Type", value: input.toolType },
      ],
      body_parameters: strictWebhookBodyParameters(input.bodyParameters),
    },
  };
}

export async function ensureTransovoSharedWorkflowTools(input: {
  workspaceId: string;
  agentId: string;
  transferTargets?: Array<{ name: string; to: string }>;
}): Promise<TransovoSharedToolSet> {
  const base = getAppBaseUrl();
  const existing = await listSharedTools().catch(() => []);

  async function ensureWebhookTool(
    displayName: string,
    toolType: string,
    description: string,
    urlPath: string,
    body: Record<string, unknown>,
  ): Promise<string | null> {
    const found = existing.find((t) => t.display_name === displayName)?.id;
    if (found) return found;
    const byName = await findToolByDisplayName(displayName).catch(() => null);
    if (byName) return byName;

    const payload = webhookToolBody({
      name: displayName,
      description,
      url: `${base}${urlPath}`,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType,
      bodyParameters: body,
    });

    try {
      const created = await ai.createSharedTool(payload);
      return unwrapToolId(created);
    } catch (err) {
      console.warn("[shared-tools] create failed", displayName, err);
      return null;
    }
  }

  const sendResourceId = await ensureWebhookTool(
    TOOL_DISPLAY_NAMES.sendResource,
    "send_resource",
    "Send an approved resource link to the caller by SMS. Only provide resource_type.",
    "/api/voice/tools/send-resource",
    {
      type: "object",
      properties: {
        resource_type: {
          type: "string",
          enum: ["booking", "quote", "financing", "directions", "photo_upload"],
          description: "Which approved resource link to text the caller.",
        },
      },
      required: ["resource_type"],
    },
  );

  const searchDetailsId = await ensureWebhookTool(
    TOOL_DISPLAY_NAMES.searchDetails,
    "search_business_details",
    "Search detailed business or product documentation for long-tail questions.",
    "/api/voice/tools/search-details",
    {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The specific detailed question to look up.",
        },
      },
      required: ["query"],
    },
  );

  let hangupId =
    existing.find((t) => t.display_name === TOOL_DISPLAY_NAMES.hangup)?.id || null;
  if (!hangupId) {
    try {
      const created = await ai.createSharedTool({
        type: "hangup",
        display_name: TOOL_DISPLAY_NAMES.hangup,
        hangup: {
          description:
            "End the call only after the caller clearly says goodbye and the conversation is finished.",
        },
      });
      hangupId = unwrapToolId(created);
    } catch {
      hangupId = null;
    }
  }

  let transferId =
    existing.find((t) => t.display_name === TOOL_DISPLAY_NAMES.transfer)?.id || null;
  const targets = (input.transferTargets || [])
    .filter((t) => t?.name && t?.to)
    .slice(0, 6)
    .map((t) => ({
      name: t.name,
      to: t.to.startsWith("+") ? t.to : `+${t.to.replace(/\D/g, "")}`,
    }));
  if (!transferId && targets.length) {
    try {
      const created = await ai.createSharedTool({
        type: "transfer",
        display_name: TOOL_DISPLAY_NAMES.transfer,
        transfer: {
          name: "transfer_to_human",
          description: "Transfer the caller to a human phone destination.",
          targets,
        },
      });
      transferId = unwrapToolId(created);
    } catch {
      transferId = null;
    }
  }

  return { sendResourceId, searchDetailsId, hangupId, transferId };
}
