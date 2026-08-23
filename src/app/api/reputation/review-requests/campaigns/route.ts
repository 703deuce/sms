import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { createServiceClient } from "@/lib/db/client";
import {
  createReviewCampaign,
  duplicateCampaign,
  listCampaigns,
  type CampaignChannel,
  type CreateCampaignInput,
} from "@/lib/reputation/campaigns";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import type { ValidatedRecipient } from "@/lib/reputation/bulk-validate";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { ymdInTimeZone } from "@/lib/reputation/campaign-scheduler";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const campaigns = await listCampaigns(businessId);
    return NextResponse.json({ campaigns });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to list campaigns");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessId,
      duplicateFrom,
      name,
      channel,
      templateId,
      emailTemplateId,
      dailySendLimit,
      sendDays,
      sendWindowStart,
      sendWindowEnd,
      timezone,
      duplicateProtectionDays,
      startDate,
      consentConfirmed,
      filename,
      mapping,
      recipients,
      status,
      sequence,
      description,
      objective,
      successMode,
      sourceTemplateId,
      sourceTemplateVersion,
      triggerType,
      triggerConfig,
      webhookEndpointId,
      enrollmentSource,
    } = body as {
      businessId?: string;
      duplicateFrom?: string;
      name?: string;
      channel?: CampaignChannel;
      templateId?: string | null;
      emailTemplateId?: string | null;
      dailySendLimit?: number;
      sendDays?: number[];
      sendWindowStart?: string;
      sendWindowEnd?: string;
      timezone?: string;
      duplicateProtectionDays?: number;
      startDate?: string;
      consentConfirmed?: boolean;
      filename?: string;
      mapping?: Record<string, CsvMapTarget>;
      recipients?: ValidatedRecipient[];
      status?: "draft" | "scheduled" | "active";
      sequence?: CreateCampaignInput["sequence"];
      description?: string | null;
      objective?: CreateCampaignInput["objective"];
      successMode?: CreateCampaignInput["successMode"];
      sourceTemplateId?: string | null;
      sourceTemplateVersion?: string | null;
      triggerType?: CreateCampaignInput["triggerType"];
      triggerConfig?: CreateCampaignInput["triggerConfig"];
      webhookEndpointId?: string | null;
      enrollmentSource?: CreateCampaignInput["enrollmentSource"];
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (duplicateFrom) {
      const supabase = createServiceClient();
      const { data: sourceCampaign } = await supabase
        .from("review_request_campaigns")
        .select("id")
        .eq("id", duplicateFrom)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!sourceCampaign) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      // Duplicates are drafts — do not burn bulk quota until launch.
      const result = await duplicateCampaign(duplicateFrom, businessId, auth.organizationId);
      return NextResponse.json(result);
    }

    if (!name || !recipients || !mapping) {
      return NextResponse.json({ error: "name, recipients, and mapping required" }, { status: 400 });
    }

    const tz = timezone ?? "America/New_York";
    const launchStatus = status ?? "active";
    const readyCount = recipients.filter((r) => r.status === "ready").length;
    let permAuth: Awaited<ReturnType<typeof requireOrganizationPermission>> | null = null;
    if (launchStatus === "active" || launchStatus === "scheduled") {
      await requireRecentAuth();
      permAuth = await requireOrganizationPermission("campaign.send", auth.organizationId);
    }
    // Reserve bulk quota only when launching (not draft saves).
    const shouldReserve = launchStatus !== "draft" && readyCount > 0;
    if (shouldReserve) {
      await reserveUsageOrThrow(auth.organizationId, "bulk_review_requests_used", readyCount);
    }

    const input: CreateCampaignInput = {
      organizationId: auth.organizationId,
      businessId,
      name,
      channel: channel ?? "both",
      templateId,
      emailTemplateId,
      dailySendLimit: dailySendLimit ?? 10,
      sendDays: sendDays ?? [1, 2, 3, 4, 5],
      sendWindowStart: sendWindowStart ?? "10:00",
      sendWindowEnd: sendWindowEnd ?? "18:00",
      timezone: tz,
      duplicateProtectionDays: duplicateProtectionDays ?? 90,
      startDate: startDate ?? ymdInTimeZone(new Date(), tz),
      consentConfirmed: consentConfirmed ?? false,
      filename,
      mapping,
      recipients,
      status: launchStatus,
      sequence,
      description: description ?? null,
      objective,
      successMode,
      sourceTemplateId,
      sourceTemplateVersion,
      triggerType,
      triggerConfig,
      webhookEndpointId,
      enrollmentSource,
    };

    try {
      const result = await createReviewCampaign(input);
      // Wire webhook endpoint → campaign for automatic triggers.
      if (
        (triggerType === "webhook" || result.campaign.trigger_type === "webhook") &&
        webhookEndpointId
      ) {
        const supabase = createServiceClient();
        await supabase
          .from("integration_webhook_endpoints")
          .update({
            campaign_id: result.campaign.id,
            default_campaign_id: result.campaign.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", webhookEndpointId)
          .eq("business_id", businessId)
          .eq("organization_id", auth.organizationId);
      }
      if (permAuth && (launchStatus === "active" || launchStatus === "scheduled")) {
        const meta = requestAuditMeta(request);
        await writeSecurityAuditEvent({
          action: "campaign.launch",
          organizationId: auth.organizationId,
          actorUserId: permAuth.userId,
          actorEmail: permAuth.email,
          resourceType: "review_request_campaign",
          resourceId: result.campaign.id,
          meta: { status: launchStatus, readyCount },
          ...meta,
        });
      }
      return NextResponse.json(result);
    } catch (createErr) {
      if (shouldReserve) {
        await releaseUsage(auth.organizationId, "bulk_review_requests_used", readyCount).catch(
          () => undefined
        );
      }
      throw createErr;
    }
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Failed to create campaign");
  }
}
