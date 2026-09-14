/**
 * Telnyx shared tools library — create/reuse org-level tools for workflows.
 */

import * as ai from "./ai-client";
import { TelnyxApiError } from "./ai-client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { strictWebhookBodyParameters } from "@/lib/voice/schema/strict-tool-schema";
import {
  SEARCH_BUSINESS_DETAILS_WEBHOOK_BODY,
  SEND_RESOURCE_WEBHOOK_BODY,
} from "@/lib/voice/tools/builtin-webhook-bodies";
import { BUILTIN_WEBHOOK_BODIES } from "@/lib/voice/tools/catalog";

export type TransovoSharedToolSet = {
  sendResourceId: string | null;
  searchDetailsId: string | null;
  voiceAiBookingId: string | null;
  hangupId: string | null;
  transferId: string | null;
};

const TOOL_DISPLAY_NAMES = {
  sendResource: "transovo-send-resource",
  searchDetails: "transovo-search-business-details",
  voiceAiBooking: "transovo-voice-ai-booking-turn",
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
      timeout_ms: 25000,
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
    const payload = webhookToolBody({
      name: displayName,
      description,
      url: `${base}${urlPath}`,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType,
      bodyParameters: body,
    });

    const found = existing.find((t) => t.display_name === displayName)?.id;
    const byName = found || (await findToolByDisplayName(displayName).catch(() => null));
    if (byName) {
      try {
        await ai.updateSharedTool(byName, payload);
        return byName;
      } catch (err) {
        const stale =
          err instanceof TelnyxApiError && (err.status === 404 || err.status === 410);
        if (stale) {
          console.warn("[shared-tools] stale id, recreating", displayName, byName);
          const created = await ai.createSharedTool(payload);
          return unwrapToolId(created);
        }
        console.warn("[shared-tools] update failed", displayName, err);
        return byName;
      }
    }

    try {
      const created = await ai.createSharedTool(payload);
      return unwrapToolId(created);
    } catch (err) {
      console.warn("[shared-tools] create failed", displayName, err);
      return null;
    }
  }

  const unifiedToolsUrl = "/api/telnyx/voice/tools";

  const sendResourceId = await ensureWebhookTool(
    TOOL_DISPLAY_NAMES.sendResource,
    "send_resource",
    "Send an approved resource link to the caller by SMS. Requires verbal_sms_consent when the caller agreed to text.",
    unifiedToolsUrl,
    SEND_RESOURCE_WEBHOOK_BODY,
  );

  const searchDetailsId = await ensureWebhookTool(
    TOOL_DISPLAY_NAMES.searchDetails,
    "search_business_details",
    "Search detailed business or product documentation for long-tail questions.",
    unifiedToolsUrl,
    SEARCH_BUSINESS_DETAILS_WEBHOOK_BODY,
  );

  const voiceBookingDef = BUILTIN_WEBHOOK_BODIES.voice_ai_booking_turn;
  const voiceAiBookingId = voiceBookingDef
    ? await ensureWebhookTool(
        TOOL_DISPLAY_NAMES.voiceAiBooking,
        voiceBookingDef.toolType,
        voiceBookingDef.description,
        unifiedToolsUrl,
        voiceBookingDef.body,
      )
    : null;

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

  return { sendResourceId, searchDetailsId, voiceAiBookingId, hangupId, transferId };
}
