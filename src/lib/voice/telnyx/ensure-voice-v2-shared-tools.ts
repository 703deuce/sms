import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import * as ai from "./ai-client";
import { TelnyxApiError } from "./ai-client";
import {
  VOICE_V2_BOOK_OFFERED_SLOT_BODY,
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_BOOK_TELNYX_TOOL_NAME,
  VOICE_V2_FIND_AVAILABILITY_BODY,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_BODY,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
  VOICE_V2_TELNYX_TOOL_NAME,
} from "@/lib/voice-v2/telnyx-tool-definition";
import type { VoiceV2SharedToolIds } from "./voice-v2-shared-tools";

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

async function ensureSharedWebhookTool(input: {
  workspaceId: string;
  agentId: string;
  displayName: string;
  toolType: string;
  urlPath: string;
  bodyParameters: Record<string, unknown>;
  timeoutMs: number;
  description: string;
}): Promise<string> {
  const base = getAppBaseUrl();
  const url = `${base.replace(/\/$/, "")}${input.urlPath}`;
  const payload = {
    type: "webhook",
    display_name: input.displayName,
    webhook: {
      name: input.toolType,
      description: input.description,
      url,
      method: "POST",
      timeout_ms: input.timeoutMs,
      headers: [
        { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
        { name: "X-Transovo-Agent-Id", value: input.agentId },
        { name: "X-Transovo-Tool-Type", value: input.toolType },
      ],
      body_parameters: input.bodyParameters,
    },
  };

  const listed = await ai.listSharedTools().catch(() => ({ data: [] }));
  const tools = (listed as { data?: Array<{ id: string; display_name?: string }> }).data || [];
  const existing = tools.find((t) => t.display_name === input.displayName);
  if (existing?.id) {
    try {
      await ai.updateSharedTool(existing.id, payload);
      return existing.id;
    } catch (err) {
      if (!(err instanceof TelnyxApiError) || (err.status !== 404 && err.status !== 410)) {
        throw err;
      }
    }
  }
  const created = await ai.createSharedTool(payload);
  const id = unwrapToolId(created);
  if (!id) throw new Error("createSharedTool_missing_id");
  return id;
}

/** Idempotent — (re)create/update V2 shared tools from config authority, not Telnyx leftovers. */
export async function ensureVoiceV2SharedToolsForAgent(input: {
  workspaceId: string;
  agentId: string;
}): Promise<VoiceV2SharedToolIds> {
  const findId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/find-availability",
    bodyParameters: VOICE_V2_FIND_AVAILABILITY_BODY,
    timeoutMs: 10000,
    description: "Voice Booking V2: structured FIND_AVAILABILITY only.",
  });
  const bookId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_BOOK_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/book-offered-slot",
    bodyParameters: VOICE_V2_BOOK_OFFERED_SLOT_BODY,
    timeoutMs: 15000,
    description: "Voice Booking V2: book using offer_set_id + selected_slot_id.",
  });
  const saveIntakeId = await ensureSharedWebhookTool({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    displayName: VOICE_V2_SAVE_INTAKE_TELNYX_TOOL_NAME,
    toolType: VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
    urlPath: "/api/telnyx/voice-v2/save-intake-fields",
    bodyParameters: VOICE_V2_SAVE_INTAKE_BODY,
    timeoutMs: 5000,
    description: "Voice Booking V2: save caller intake fields in one call.",
  });
  return { findId, bookId, saveIntakeId };
}
