import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { sendQuickSms } from "@/lib/sms/send-quick";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      workspaceId?: string;
      to?: string;
      customerPhone?: string;
      message?: string;
      body?: string;
      customMessage?: string;
      from?: string;
      campaignId?: string;
      customerName?: string;
      destinationUrl?: string;
      mediaUrls?: string[];
      senderPoolId?: string;
      inboxCompose?: boolean;
      mctbCompose?: boolean;
    };

    const workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);

    if (body.inboxCompose) {
      const { getMessagingRuntimeSettings, resolveInboxPermissions } = await import(
        "@/lib/messaging/messaging-settings"
      );
      const runtime = await getMessagingRuntimeSettings(workspaceId);
      const perms = resolveInboxPermissions(runtime.inboxPermissionsJson);
      if (perms.inboxEnabled === false) {
        return NextResponse.json({ error: "Inbox is disabled for this workspace" }, { status: 403 });
      }
      if (perms.allowStartConversations === false) {
        return NextResponse.json({ error: "Starting conversations is disabled" }, { status: 403 });
      }
    }

    if (body.mctbCompose) {
      const { resolveMctbCapabilities } = await import("@/lib/mctb/capabilities");
      const caps = await resolveMctbCapabilities(workspaceId);
      if (!caps.manualTwoWayMessaging) {
        return NextResponse.json(
          {
            error:
              "Manual replies from Conversations require an approved customer-owned text-back sender.",
          },
          { status: 403 },
        );
      }
    }
    const to = body.to || body.customerPhone;
    const message = body.message || body.body || body.customMessage;

    if (!to || !message) {
      return NextResponse.json({ error: "to (or customerPhone) and message are required" }, { status: 400 });
    }

    const result = await sendQuickSms({
      workspaceId,
      to,
      body: message,
      from: body.from,
      campaignId: body.campaignId,
      customerName: body.customerName,
      destinationUrl: body.destinationUrl,
      mediaUrls: body.mediaUrls,
      senderPoolId: body.senderPoolId,
      idempotencyKey:
        request.headers.get("idempotency-key") ||
        request.headers.get("x-idempotency-key") ||
        undefined,
    });

    if (body.inboxCompose) {
      const { recordInboxComposeSend } = await import("@/lib/inbox/inbox-compose");
      const { conversationId } = await recordInboxComposeSend({
        workspaceId,
        to,
        body: message,
        fromE164: body.from,
        mediaUrls: body.mediaUrls,
        userName: auth.session.name ?? auth.session.email ?? null,
      });
      return NextResponse.json({ data: { ...result, conversationId } });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
