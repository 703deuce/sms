import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getBusinessCallbackStatus } from "@/lib/smart-routing/business-callback-service";
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
    const businessCallerIdE164 = body.businessCallerIdE164
      ? String(body.businessCallerIdE164)
      : null;
    const initiationMethod = body.initiationMethod
      ? String(body.initiationMethod)
      : "dashboard_ringout";

    if (!destinationE164 || !authorizedCallerId) {
      return jsonError(new Error("destinationE164 and authorizedCallerId are required"), 400);
    }

    const { initiateBusinessCallback } = await import(
      "@/lib/smart-routing/business-callback-service"
    );
    const sourceTypeMap: Record<string, string> = {
      last_call: "routing_activity",
      missed_call: "missed_call",
      voicemail: "voicemail",
      callback_request: "callback_request",
      manual: "manual",
      dashboard: "manual",
      activity: "routing_activity",
      conversation: "conversation",
    };

    const result = await initiateBusinessCallback({
      workspaceId: auth.workspaceId,
      authorizedCallerId,
      destinationE164,
      businessCallerIdE164,
      sourceType: (sourceTypeMap[contextType] ?? "manual") as import(
        "@/lib/smart-routing/business-callback-types"
      ).BusinessCallbackSourceType,
      sourceId: contextRefId,
      initiationMethod: initiationMethod as import(
        "@/lib/smart-routing/business-callback-types"
      ).BusinessCallbackInitiationMethod,
      initiatedByUserId: auth.session.userId,
      destinationContactName,
      originalInboundSessionId:
        contextType === "activity" || contextType === "last_call" ? contextRefId : undefined,
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
