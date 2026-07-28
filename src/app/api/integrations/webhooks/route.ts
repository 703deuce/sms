import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createIntegrationWebhook,
  listIntegrationWebhooks,
  revokeIntegrationWebhook,
  rotateIntegrationWebhook,
} from "@/lib/integrations/webhook-process";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listIntegrationWebhooks(auth.workspaceId);
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
      action?: "create" | "rotate" | "revoke";
      name?: string;
      campaignId?: string;
      sendDelayMinutes?: number;
      fieldMap?: Prisma.InputJsonValue;
      endpointId?: string;
      workspaceId?: string;
    };
    const workspaceId = body.workspaceId || auth.workspaceId;
    const action = body.action || "create";

    if (action === "create") {
      if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
      const data = await createIntegrationWebhook({
        workspaceId,
        name: body.name,
        campaignId: body.campaignId,
        sendDelayMinutes: body.sendDelayMinutes,
        fieldMap: body.fieldMap,
      });
      return NextResponse.json({ data }, { status: 201 });
    }

    if (!body.endpointId) return NextResponse.json({ error: "endpointId required" }, { status: 400 });

    if (action === "rotate") {
      const data = await rotateIntegrationWebhook(workspaceId, body.endpointId);
      return NextResponse.json({ data });
    }
    if (action === "revoke") {
      const data = await revokeIntegrationWebhook(workspaceId, body.endpointId);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
