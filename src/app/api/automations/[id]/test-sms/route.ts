import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mergeMessageVars } from "@/lib/automations/actions";
import { sendQuickSms } from "@/lib/sms/send-quick";

/**
 * Builder test SMS — does not create automation executions.
 * Sends to a subscribed contact in the same workspace with merged variables.
 * Outbound uses the workspace messaging registration (Telnyx in production).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: flowId } = await params;

    const flow = await getPrisma().automationFlow.findFirst({
      where: { id: flowId, workspaceId: auth.workspaceId },
    });
    if (!flow) return NextResponse.json({ error: "Automation not found" }, { status: 404 });

    const body = (await request.json()) as {
      contactId?: string;
      messageBody?: string;
      body?: string;
      fromNumber?: string;
      nodeId?: string;
    };

    if (!body.contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const rawBody = String(body.messageBody || body.body || "").trim();
    if (!rawBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    const contact = await getPrisma().contact.findFirst({
      where: { id: body.contactId, workspaceId: auth.workspaceId },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found in this workspace" }, { status: 404 });
    }
    if (contact.status !== "SUBSCRIBED") {
      return NextResponse.json(
        { error: "Test SMS can only be sent to subscribed contacts" },
        { status: 400 },
      );
    }

    const merged = await mergeMessageVars(auth.workspaceId, contact, rawBody);
    const idempotencyKey = `builder-test:${flowId}:${body.nodeId || "sms"}:${contact.id}:${Date.now()}`;

    const result = await sendQuickSms({
      workspaceId: auth.workspaceId,
      to: contact.phone,
      body: merged,
      from: body.fromNumber,
      idempotencyKey,
      customerName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
    });

    return NextResponse.json({
      data: {
        messageId: result.messageId,
        status: result.status,
        trackingUrl: result.trackingUrl,
        test: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
