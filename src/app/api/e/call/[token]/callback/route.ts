import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { validateEmployeeAccessToken } from "@/lib/smart-routing/employee-access-token-service";
import { initiateBusinessCallback } from "@/lib/smart-routing/business-callback-service";
import type { BusinessCallbackSourceType } from "@/lib/smart-routing/business-callback-types";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const grant = await validateEmployeeAccessToken(token);
    if (!grant) return jsonError(new Error("Invalid or expired link"), 401);

    const body = await request.json();
    const destinationE164 = String(body.destinationE164 || "").trim();
    const businessCallerIdE164 = body.businessCallerIdE164
      ? String(body.businessCallerIdE164)
      : null;
    const sourceType = String(body.sourceType || "manual") as BusinessCallbackSourceType;
    const sourceId = body.sourceId ? String(body.sourceId) : null;
    const destinationContactName = body.destinationContactName
      ? String(body.destinationContactName)
      : null;

    if (!destinationE164) return jsonError(new Error("destinationE164 required"), 400);

    const result = await initiateBusinessCallback({
      workspaceId: grant.workspaceId,
      authorizedCallerId: grant.authorizedCallerId,
      destinationE164,
      businessCallerIdE164,
      sourceType,
      sourceId,
      initiationMethod: "employee_link",
      originalInboundSessionId:
        sourceType === "routing_activity" ? sourceId : undefined,
      destinationContactName,
    });

    const { getBusinessCallbackStatus } = await import(
      "@/lib/smart-routing/business-callback-service"
    );
    const status = await getBusinessCallbackStatus(
      result.outboundCallId,
      grant.workspaceId,
    );

    return NextResponse.json({ data: { ...result, status } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
