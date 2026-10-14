import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import {
  getCampaignDetail,
  getRecipientEventHistory,
  updateCampaignStatus,
  type CampaignStatus,
} from "@/lib/reputation/campaigns";
import { createServiceClient } from "@/lib/db/client";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    const recipientId = url.searchParams.get("recipientId");
    if (recipientId) {
      const history = await getRecipientEventHistory({
        campaignId,
        businessId,
        recipientId,
      });
      return NextResponse.json(history);
    }

    const detail = await getCampaignDetail(campaignId, businessId, {
      recipientCursor: url.searchParams.get("cursor"),
      recipientLimit: Number(url.searchParams.get("limit") ?? 50),
      recipientStatus: url.searchParams.get("recipientStatus"),
    });
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to load campaign");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const { businessId, action } = body as { businessId?: string; action?: string };

    if (!businessId || !action) {
      return NextResponse.json({ error: "businessId and action required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (action === "archive") {
      const campaign = await updateCampaignStatus(
        campaignId,
        businessId,
        "archived",
        auth.organizationId
      );
      const supabase = createServiceClient();
      await supabase
        .from("review_request_campaigns")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", campaignId)
        .eq("business_id", businessId);
      return NextResponse.json({ campaign: { ...campaign, archived_at: new Date().toISOString() } });
    }

    // Pause/resume new enrollments without stopping in-flight sending.
    if (action === "pause_enrollments" || action === "resume_enrollments") {
      const supabase = createServiceClient();
      const { data: campaign, error } = await supabase
        .from("review_request_campaigns")
        .update({
          enrollments_paused: action === "pause_enrollments",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("business_id", businessId)
        .eq("organization_id", auth.organizationId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      return NextResponse.json({ campaign });
    }

    // Attach / update trigger config (e.g. link webhook after draft).
    if (action === "set_trigger") {
      const supabase = createServiceClient();
      const triggerType = body.triggerType as string | undefined;
      const triggerConfig = body.triggerConfig as Record<string, unknown> | undefined;
      const webhookEndpointId = body.webhookEndpointId as string | null | undefined;
      const { data: campaign, error } = await supabase
        .from("review_request_campaigns")
        .update({
          ...(triggerType ? { trigger_type: triggerType } : {}),
          ...(triggerConfig ? { trigger_config: triggerConfig } : {}),
          ...(webhookEndpointId !== undefined
            ? { webhook_endpoint_id: webhookEndpointId }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("business_id", businessId)
        .eq("organization_id", auth.organizationId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      if (webhookEndpointId && (triggerType === "webhook" || campaign.trigger_type === "webhook")) {
        await supabase
          .from("integration_webhook_endpoints")
          .update({
            campaign_id: campaignId,
            default_campaign_id: campaignId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", webhookEndpointId)
          .eq("business_id", businessId)
          .eq("organization_id", auth.organizationId);
      }
      return NextResponse.json({ campaign });
    }

    const statusMap: Record<string, CampaignStatus> = {
      pause: "paused",
      resume: "active",
      cancel: "cancelled",
      start: "active",
    };
    const status = statusMap[action];
    if (!status) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: before } = await supabase
      .from("review_request_campaigns")
      .select("status")
      .eq("id", campaignId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (!before) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const isLaunchToActive =
      status === "active" &&
      before.status !== "active" &&
      (action === "start" || action === "resume" || before.status === "draft");

    let permAuth: Awaited<ReturnType<typeof requireOrganizationPermission>> | null = null;
    let reservedReady = 0;
    if (isLaunchToActive) {
      await requireRecentAuth();
      permAuth = await requireOrganizationPermission("campaign.send", auth.organizationId);
    }

    if (status === "active" && before.status === "draft") {
      const { data: readyRecs } = await supabase
        .from("review_request_recipients")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("business_id", businessId)
        .eq("status", "ready");
      reservedReady = readyRecs?.length ?? 0;
      if (reservedReady > 0) {
        await reserveUsageOrThrow(auth.organizationId, "bulk_review_requests_used", reservedReady);
      }
    }

    try {
      const campaign = await updateCampaignStatus(
        campaignId,
        businessId,
        status,
        auth.organizationId
      );
      if (isLaunchToActive && permAuth) {
        const meta = requestAuditMeta(request);
        await writeSecurityAuditEvent({
          action: "campaign.launch",
          organizationId: auth.organizationId,
          actorUserId: permAuth.userId,
          actorEmail: permAuth.email,
          resourceType: "review_request_campaign",
          resourceId: campaignId,
          meta: { previousStatus: before.status, action },
          ...meta,
        });
      }
      return NextResponse.json({ campaign });
    } catch (updateErr) {
      if (reservedReady > 0) {
        await releaseUsage(auth.organizationId, "bulk_review_requests_used", reservedReady).catch(
          () => undefined
        );
      }
      throw updateErr;
    }
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Failed to update campaign");
  }
}
