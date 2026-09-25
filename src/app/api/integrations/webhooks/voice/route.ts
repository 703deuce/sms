import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import {
  createOutboundVoiceWebhook,
  deleteOutboundVoiceWebhook,
  listOutboundVoiceWebhooks,
  sendOutboundVoiceWebhookTest,
  updateOutboundVoiceWebhook,
} from "@/lib/voice-v3/webhooks/outbound";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listOutboundVoiceWebhooks(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: "create" | "update" | "delete" | "test";
      webhookId?: string;
      workspaceId?: string;
      url?: string;
      label?: string;
      events?: string[];
      active?: boolean;
    };
    const workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
    const action = body.action || "create";

    if (action === "create") {
      if (!body.url?.trim()) {
        return NextResponse.json({ error: "url required" }, { status: 400 });
      }
      if (!body.label?.trim()) {
        return NextResponse.json({ error: "label required" }, { status: 400 });
      }
      if (!body.events?.length) {
        return NextResponse.json({ error: "events required" }, { status: 400 });
      }
      const data = await createOutboundVoiceWebhook(workspaceId, {
        url: body.url,
        label: body.label,
        events: body.events,
        active: body.active,
      });
      return NextResponse.json({ data }, { status: 201 });
    }

    if (!body.webhookId) {
      return NextResponse.json({ error: "webhookId required" }, { status: 400 });
    }

    if (action === "update") {
      const data = await updateOutboundVoiceWebhook(workspaceId, body.webhookId, {
        url: body.url,
        label: body.label,
        events: body.events,
        active: body.active,
      });
      return NextResponse.json({ data });
    }

    if (action === "delete") {
      const data = await deleteOutboundVoiceWebhook(workspaceId, body.webhookId);
      return NextResponse.json({ data });
    }

    if (action === "test") {
      const data = await sendOutboundVoiceWebhookTest(workspaceId, body.webhookId);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
