/**
 * Request-level ingress logging for Telnyx AI Assistant webhook tools.
 *
 * Every POST to /api/telnyx/voice/tools is recorded here BEFORE workspace/agent
 * validation so we can distinguish:
 * - Telnyx never invoked a tool (no ingress row)
 * - Telnyx invoked but headers/body failed our gate (ingress + early 200)
 * - Tool reached executeBuiltinVoiceAction (ingress + voiceToolExecution)
 */
import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";

const REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "x-transovo-workspace-id",
  "x-transovo-agent-id",
]);

function headerSnapshot(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (REDACT_KEYS.has(k)) {
      out[k] = "<redacted>";
      return;
    }
    if (k.startsWith("x-transovo-") || k.startsWith("x-telnyx-") || k === "content-type") {
      out[k] = value.length > 256 ? `${value.slice(0, 256)}…` : value;
    }
  });
  return out;
}

function bodyPreview(body: Record<string, unknown>): Record<string, unknown> {
  const preview: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body).slice(0, 24)) {
    if (typeof v === "string" && v.length > 200) {
      preview[k] = `${v.slice(0, 200)}…`;
    } else {
      preview[k] = v;
    }
  }
  if (Object.keys(body).length > 24) {
    preview._truncated = Object.keys(body).length - 24;
  }
  return preview;
}

export type ToolWebhookIngressRecord = {
  ingressId: string;
  workspaceId: string;
  agentId: string;
  toolType: string;
  toolId: string;
  callControlId: string;
  conversationId: string;
};

/**
 * Persist an ingress row. Failures are swallowed — logging must never block tools.
 */
export async function recordToolWebhookIngress(input: {
  request: Request;
  body: Record<string, unknown>;
}): Promise<ToolWebhookIngressRecord> {
  const { request, body } = input;
  const workspaceId = request.headers.get("x-transovo-workspace-id")?.trim() || "";
  const agentId = request.headers.get("x-transovo-agent-id")?.trim() || "";
  const toolType = request.headers.get("x-transovo-tool-type")?.trim() || "";
  const toolId = request.headers.get("x-transovo-tool-id")?.trim() || "";
  const callControlId =
    request.headers.get("x-telnyx-call-control-id")?.trim() ||
    String(body.call_control_id || body.callControlId || "");
  const conversationId =
    request.headers.get("x-telnyx-conversation-id")?.trim() ||
    String(body.telnyx_conversation_id || body.conversation_id || "");

  const fingerprint = createHash("sha256")
    .update(
      [
        workspaceId,
        agentId,
        toolType,
        toolId,
        callControlId,
        conversationId,
        JSON.stringify(bodyPreview(body)),
        String(Date.now()),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 24);

  const ingressId = `voice-tool-ingress:${fingerprint}:${Date.now()}`;

  const record: ToolWebhookIngressRecord = {
    ingressId,
    workspaceId,
    agentId,
    toolType,
    toolId,
    callControlId,
    conversationId,
  };

  console.info(
    "[telnyx/voice/tools/ingress]",
    JSON.stringify({
      ingressId,
      workspaceId: workspaceId || null,
      agentId: agentId || null,
      toolType: toolType || null,
      toolId: toolId || null,
      callControlId: callControlId || null,
      conversationId: conversationId || null,
      headers: headerSnapshot(request),
      body: bodyPreview(body),
    }),
  );

  try {
    const prisma = getPrisma();
    await prisma.providerWebhookEvent.create({
      data: {
        provider: "telnyx",
        eventType: "voice.tool_webhook.ingress",
        providerEventId: ingressId,
        workspaceId: workspaceId || undefined,
        payload: {
          ...record,
          headers: headerSnapshot(request),
          body: bodyPreview(body),
        } as object,
        status: "received",
      },
    });
  } catch (err) {
    console.warn(
      "[telnyx/voice/tools/ingress] persist failed",
      err instanceof Error ? err.message : err,
    );
  }

  return record;
}
