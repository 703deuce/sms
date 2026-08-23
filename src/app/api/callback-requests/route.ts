import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  createCallbackRequest,
  updateCallbackRequestStatus,
  type CallbackStatus,
} from "@/lib/callback-requests/service";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const rows = await prisma.callbackRequest.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { requestedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const entitled = await hasWorkspaceProductFeature(auth.workspaceId, "callback_requests");
    if (!entitled) return jsonError(new Error("Callback Requests not enabled"), 403);
    const body = await request.json();
    const row = await createCallbackRequest({
      workspaceId: auth.workspaceId,
      callerE164: String(body.callerE164 || ""),
      businessE164: body.businessE164 ? String(body.businessE164) : null,
      phoneNumberId: body.phoneNumberId ? String(body.phoneNumberId) : null,
      smartRoutingSessionId: body.smartRoutingSessionId
        ? String(body.smartRoutingSessionId)
        : null,
      sourceRoute: body.sourceRoute ? String(body.sourceRoute) : null,
      reason: body.reason ? String(body.reason) : null,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const id = String(body.id || "");
    const status = String(body.status || "") as CallbackStatus;
    if (!id || !status) return jsonError(new Error("id and status required"), 400);
    const row = await updateCallbackRequestStatus(auth.workspaceId, id, status, {
      completedByUserId:
        status === "completed" ? auth.session.userId : undefined,
      assignedToUserId: body.assignedToUserId
        ? String(body.assignedToUserId)
        : undefined,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
