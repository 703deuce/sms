import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireCampaignSendAccess } from "@/lib/auth/entitlements";
import { enrollContactInCampaign } from "@/lib/automations/enroll-campaign";
import { createServiceClient } from "@/lib/db/client";
import { parseTriggerConfig } from "@/lib/reputation/campaign-triggers";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

/**
 * Manually enroll one contact into a campaign (works for manual and webhook campaigns).
 * Uses the shared enrollment engine — same path as CSV / webhook / API.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const permAuth = await requireOrganizationPermission("campaign.send", auth.organizationId);
    await requireRecentAuth();
    await requireCampaignSendAccess(auth.organizationId);

    const supabase = createServiceClient();
    const { data: campaign } = await supabase
      .from("review_request_campaigns")
      .select("id, trigger_type, trigger_config")
      .eq("id", campaignId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const cfg = parseTriggerConfig(campaign.trigger_config);
    if (
      (campaign.trigger_type === "webhook" || campaign.trigger_type === "api") &&
      cfg.allowManualEnrollment === false
    ) {
      return NextResponse.json(
        { error: "Manual enrollment is disabled for this campaign" },
        { status: 403 }
      );
    }

    const result = await enrollContactInCampaign({
      organizationId: auth.organizationId,
      businessId,
      campaignId,
      preferredContactId: typeof body.contactId === "string" ? body.contactId : null,
      contact: {
        firstName: body.firstName,
        lastName: body.lastName,
        name: body.name ?? body.customerName,
        phone: body.phone,
        email: body.email,
        notes: body.notes,
        jobType: body.jobType,
        serviceDate: body.serviceDate,
      },
      enrollmentSource: "manual",
      allowWhilePaused: false,
    });

    const auditMeta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "campaign.send",
      organizationId: auth.organizationId,
      actorUserId: permAuth.userId,
      actorEmail: permAuth.email,
      resourceType: "review_request_campaign",
      resourceId: campaignId,
      meta: { enrollmentSource: "manual", contactId: result.contactId ?? null },
      ...auditMeta,
    });

    return NextResponse.json(result);
  } catch (err) {
    return httpErrorFromException(err, "Enrollment failed");
  }
}
