import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { ensureToolWebhookCallContext } from "@/lib/voice/tools/ensure-tool-webhook-call-context";
import { recordToolWebhookIngress } from "@/lib/voice/telnyx/tool-webhook-ingress";
import { formatTelnyxToolPayload } from "@/lib/voice/telnyx/format-speak-text";
import {
  telnyxToolJsonBody,
  type WorkflowToolResponse,
} from "@/lib/voice/tools/workflow-tool-contract";
import { assertWorkflowToolAllowed } from "@/lib/voice/workflow-engine/workflow-tool-guard";

export type NarrowToolHandler = (input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  body: Record<string, unknown>;
  conversationId?: string;
  callControlId?: string;
  inboundAni?: string;
}) => Promise<WorkflowToolResponse>;

function resolveInboundAni(request: Request, body: Record<string, unknown>): string {
  for (const key of [
    "x-telnyx-from",
    "x-telnyx-caller-id",
    "from",
    "caller",
  ]) {
    const value = request.headers.get(key) || String(body[key] || "");
    if (value && value !== "unknown") return value;
  }
  return "";
}

export async function handleNarrowVoiceToolRequest(
  request: Request,
  toolType: string,
  handler: NarrowToolHandler,
) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  await recordToolWebhookIngress({ request, body });

  const workspaceId = request.headers.get("x-transovo-workspace-id") || "";
  const agentId = request.headers.get("x-transovo-agent-id") || "";
  if (!workspaceId) {
    return NextResponse.json(
      formatTelnyxToolPayload({
        ok: false,
        status: "invalid_input",
        result: "workspace_required",
        speak: "I'm having trouble with that request.",
      }),
      { status: 200 },
    );
  }

  const prisma = getPrisma();
  let callId: string | undefined;
  const conversationId =
    request.headers.get("x-telnyx-conversation-id") ||
    String(body.conversation_id || body.telnyx_conversation_id || "");
  const callControlId =
    request.headers.get("x-telnyx-call-control-id") ||
    String(body.call_control_id || "");

  const inboundAni = resolveInboundAni(request, body);
  const toFromBody = body.to ? String(body.to) : body.called ? String(body.called) : "";

  if (agentId && (conversationId || callControlId)) {
    callId = await ensureToolWebhookCallContext({
      workspaceId,
      agentId,
      conversationId: conversationId || undefined,
      callControlId: callControlId || undefined,
      inboundAni: inboundAni || undefined,
      toE164FromBody: toFromBody || undefined,
    });
  }

  const guard = await assertWorkflowToolAllowed({
    workspaceId,
    agentId: agentId || undefined,
    callId,
    toolType,
  });
  if (!guard.allowed) {
    return NextResponse.json(
      formatTelnyxToolPayload(
        telnyxToolJsonBody({
          ok: false,
          status: "not_allowed",
          result: guard.error_code || "tool_not_allowed",
          speak: guard.speak || "I can't do that right now.",
        }),
      ),
      { status: 200 },
    );
  }

  const result = await handler({
    workspaceId,
    agentId: agentId || null,
    callId: callId || null,
    body,
    conversationId: conversationId || undefined,
    callControlId: callControlId || undefined,
    inboundAni: inboundAni || undefined,
  });

  if (callId && result.dynamic_variables) {
    const call = await prisma.voiceCall.findUnique({
      where: { id: callId },
      select: { metadata: true },
    });
    const meta =
      call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
        ? (call.metadata as Record<string, unknown>)
        : {};
    await prisma.voiceCall.update({
      where: { id: callId },
      data: {
        metadata: {
          ...meta,
          ...result.dynamic_variables,
        },
      },
    });
  }

  return NextResponse.json(formatTelnyxToolPayload(telnyxToolJsonBody(result)), {
    status: 200,
  });
}
