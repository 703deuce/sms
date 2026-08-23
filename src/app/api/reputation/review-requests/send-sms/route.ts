import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireCampaignSendAccess } from "@/lib/auth/entitlements";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { sendReviewRequestSms } from "@/lib/reputation/review-sends";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { sendReviewSmsSchema } from "@/lib/validation/schemas";
import { httpErrorFromException } from "@/lib/security/http-errors";
import {
  getIdempotentResponse,
  readIdempotencyKey,
  storeIdempotentResponse,
} from "@/lib/security/idempotency";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

function isClientValidationError(message: string): boolean {
  return (
    message.includes("Review link missing") ||
    message.includes("phone") ||
    message.includes("opted out") ||
    message.includes("access denied") ||
    message.includes("not found")
  );
}

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  const idempotencyKey = readIdempotencyKey(request);
  if (idempotencyKey) {
    const cached = getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    const body = await request.json();
    const parsed = sendReviewSmsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await requireRecentAuth();
    const access = await requireBusinessAccess(parsed.data.businessId);
    await requireCampaignSendAccess(access.organizationId);
    const permAuth = await requireOrganizationPermission("campaign.send", access.organizationId);
    organizationId = access.organizationId;
    await reserveUsageOrThrow(access.organizationId, "review_sms_sent", 1);
    reserved = true;
    const result = await sendReviewRequestSms({
      businessId: parsed.data.businessId,
      organizationId: access.organizationId,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      serviceType: parsed.data.serviceType,
      templateId: parsed.data.templateId,
      customMessage: parsed.data.customMessage,
    });

    if (!result.ok) {
      await releaseUsage(access.organizationId, "review_sms_sent", 1).catch(() => {});
      reserved = false;
      const response = { error: result.error, sendId: result.sendId };
      if (idempotencyKey) storeIdempotentResponse(idempotencyKey, 502, response);
      return NextResponse.json(response, { status: 502 });
    }

    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "campaign.send",
      organizationId: access.organizationId,
      actorUserId: permAuth.userId,
      actorEmail: permAuth.email,
      resourceType: "review_request_send",
      resourceId: result.sendId ?? null,
      meta: { channel: "sms", businessId: parsed.data.businessId },
      ...meta,
    });

    const response = {
      ok: true,
      sendId: result.sendId,
      messageSid: result.messageSid,
      usedTrialTemplate: result.usedTrialTemplate ?? false,
    };
    if (idempotencyKey) storeIdempotentResponse(idempotencyKey, 200, response);
    return NextResponse.json(response);
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "review_sms_sent", 1).catch(() => {});
    }
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "SMS send failed";
    if (isClientValidationError(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return httpErrorFromException(err, "SMS send failed");
  }
}
