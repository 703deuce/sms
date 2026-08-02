import { NextResponse } from "next/server";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";
import { getPrisma } from "@/lib/db";
import { resolveCallDynamicVariables } from "@/lib/voice/dynamic-variables";

/**
 * Telnyx dynamic variables webhook.
 * Must respond with { dynamic_variables: { ... } } within timeout.
 * @see https://developers.telnyx.com/docs/inference/ai-assistants/dynamic-variables
 */
export async function POST(request: Request) {
  try {
    const verified = await readTelnyxWebhook(request);
    if (!verified.ok) return verified.response;

    const root = (verified.payload || {}) as Record<string, unknown>;
    const data = (root.data || root) as Record<string, unknown>;
    const payloadInner = (data.payload || data) as Record<string, unknown>;

    const callControlId = String(
      payloadInner.call_control_id || data.call_control_id || "",
    );
    const to = String(payloadInner.to || data.to || payloadInner.telnyx_call_to || "");
    const from = String(
      payloadInner.from || data.from || payloadInner.telnyx_end_user_target || "",
    );

    const prisma = getPrisma();
    let workspaceId: string | null = null;
    let agentId: string | null = null;
    let callId: string | null = null;
    let contactId: string | null = null;

    if (callControlId) {
      const call = await prisma.voiceCall.findFirst({
        where: { telnyxCallControlId: callControlId },
      });
      if (call) {
        workspaceId = call.workspaceId;
        agentId = call.agentId;
        callId = call.id;
        contactId = call.contactId;
      }
    }

    if (!workspaceId && to) {
      const pn = await prisma.phoneNumber.findFirst({ where: { e164: to } });
      if (pn) {
        workspaceId = pn.workspaceId;
        const { resolveInboundAiAgent } = await import("@/lib/voice/agent-phone");
        const agent = await resolveInboundAiAgent(pn.workspaceId, pn.id);
        agentId = agent?.id || null;
      }
    }

    if (!workspaceId) {
      return NextResponse.json({ dynamic_variables: {} });
    }

    const vars = await resolveCallDynamicVariables({
      workspaceId,
      agentId,
      callId,
      contactId,
      fromE164: from || null,
      toE164: to || null,
      direction: "INBOUND",
    });

    return NextResponse.json({ dynamic_variables: vars });
  } catch (err) {
    console.warn(
      "[telnyx/dynamic-variables]",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ dynamic_variables: {} });
  }
}
