import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  initiateOneClickBusinessCallback,
  getBusinessCallbackStatus,
} from "@/lib/smart-routing/business-callback-service";
import type { OutboundContextType } from "@/lib/smart-routing/outbound-bridge";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const destinationE164 = String(body.destinationE164 || "").trim();
    const authorizedCallerId = String(body.authorizedCallerId || "").trim();
    const contextType = String(body.contextType || "manual") as OutboundContextType;
    const contextRefId = body.contextRefId ? String(body.contextRefId) : null;
    const destinationContactName = body.destinationContactName
      ? String(body.destinationContactName)
      : null;

    if (!destinationE164 || !authorizedCallerId) {
      return jsonError(new Error("destinationE164 and authorizedCallerId are required"), 400);
    }

    const result = await initiateOneClickBusinessCallback({
      workspaceId: auth.workspaceId,
      authorizedCallerId,
      destinationE164,
      contextType,
      contextRefId,
      initiatedByUserId: auth.session.userId,
      destinationContactName,
    });

    const status = await getBusinessCallbackStatus(result.outboundCallId, auth.workspaceId);

    return NextResponse.json({
      data: {
        ...result,
        status,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
