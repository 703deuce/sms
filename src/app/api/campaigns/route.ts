import type { Prisma } from "@/lib/domain";
import { NextResponse } from "next/server";
import { requireWorkspaceFeature, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  buildSequenceForCategory,
  getCampaignCategory,
  type CampaignCategoryId,
} from "@/lib/campaigns/catalog";
import { enrollContactInCampaign, validateBulkRecipients, enrollListInCampaign, enrollSegmentInCampaign } from "@/lib/campaigns/enroll-campaign";
import { defaultSmsEmailSequence, parseSequence } from "@/lib/campaigns/sequence-engine";

export async function GET() {
  try {
    const auth = await requireWorkspaceFeature("campaigns");
    if ("error" in auth) return auth.error;
    const campaigns = await getPrisma().campaign.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ data: campaigns });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireWorkspaceFeature("campaigns");
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      workspaceId?: string;
      name?: string;
      type?: string;
      category?: string;
      audience?: string;
      message?: string;
      body?: string;
      sequenceJson?: unknown;
      config?: Record<string, unknown>;
      successMode?: string;
      dailySendLimit?: number;
      sendWindowStart?: number;
      sendWindowEnd?: number;
      scheduledAt?: string;
      listId?: string;
      segmentId?: string;
      senderPoolId?: string;
      recipients?: Array<{ phone?: string; email?: string; displayName?: string }>;
      activate?: boolean;
    };

    const workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
    const name = body.name?.trim();
    const message = (body.message || body.body || "").trim();
    if (!name || !message) {
      return NextResponse.json({ error: "name and message are required" }, { status: 400 });
    }

    const categoryMeta = getCampaignCategory(body.category);
    const categoryId = (categoryMeta?.id || body.category || null) as CampaignCategoryId | null;
    const config = body.config || {};

    const { validateCampaignMediaConfig } = await import("@/lib/mass-texting/campaign-media");
    const mediaCheck = validateCampaignMediaConfig({
      configJson: config,
      campaignType: body.type || categoryMeta?.title,
    });
    if (!mediaCheck.ok) {
      return NextResponse.json({ error: mediaCheck.error }, { status: 400 });
    }

    const { massTextingRequiresLaunchAudit } = await import("@/lib/mass-texting/campaign-guards");
    const requiresLaunchAudit = await massTextingRequiresLaunchAudit(workspaceId);
    if (requiresLaunchAudit && body.activate) {
      return NextResponse.json(
        {
          error:
            "Mass Texting campaigns must be launched through pre-send review (credits, A2P, and suppression checks).",
        },
        { status: 400 },
      );
    }

    const recurrence = config.recurrence as { nextRunAt?: string } | undefined;
    let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    let status: "DRAFT" | "SCHEDULED" | "SENDING" = body.activate
      ? "SENDING"
      : body.scheduledAt || recurrence?.nextRunAt
        ? "SCHEDULED"
        : "DRAFT";
    if (recurrence?.nextRunAt) {
      scheduledAt = new Date(recurrence.nextRunAt);
      if (!body.activate) status = "SCHEDULED";
    }

    const sequenceJson = body.sequenceJson
      ? parseSequence(body.sequenceJson)
      : categoryId
        ? buildSequenceForCategory(categoryId, message, config)
        : defaultSmsEmailSequence();

    const campaign = await getPrisma().campaign.create({
      data: {
        workspaceId,
        name,
        type: body.type || categoryMeta?.title || "Sequence",
        category: categoryId,
        audience: body.audience || "Custom",
        body: message,
        status,
        scheduledAt,
        sequenceJson: sequenceJson as Prisma.InputJsonValue,
        configJson: config as Prisma.InputJsonValue,
        senderPoolId: body.senderPoolId || null,
        successMode: body.successMode || "click",
        dailySendLimit: body.dailySendLimit,
        sendWindowStart: body.sendWindowStart,
        sendWindowEnd: body.sendWindowEnd,
        createdBy: auth.session.email,
      },
    });

    let enrolledCount = 0;
    let rejected: Array<{ reason: string }> = [];

    if (body.segmentId) {
      const segEnroll = await enrollSegmentInCampaign(workspaceId, campaign.id, body.segmentId);
      enrolledCount = segEnroll.enrolled;
      rejected = segEnroll.rejected;
    } else if (body.listId) {
      const listEnroll = await enrollListInCampaign(workspaceId, campaign.id, body.listId);
      enrolledCount = listEnroll.enrolled;
      rejected = listEnroll.rejected;
    } else {
      const bulk = await validateBulkRecipients(workspaceId, campaign.id, body.recipients || []);
      rejected = bulk.rejected;
      for (const r of bulk.accepted) {
        await enrollContactInCampaign({
          workspaceId,
          campaignId: campaign.id,
          phone: r.phone,
          email: r.email,
          displayName: r.displayName,
          contactId: r.contactId,
        });
        enrolledCount += 1;
      }
    }

    return NextResponse.json(
      { data: { campaign, enrolledCount, rejected } },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}

/** Activate / pause / resume / cancel a campaign. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireWorkspaceFeature("campaigns");
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      workspaceId?: string;
      campaignId?: string;
      action?: "activate" | "pause" | "resume" | "cancel";
    };
    const workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
    if (!body.campaignId || !body.action) {
      return NextResponse.json({ error: "campaignId and action required" }, { status: 400 });
    }

    const campaign = await getPrisma().campaign.findFirst({
      where: { id: body.campaignId, workspaceId },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    let status = campaign.status;
    if (body.action === "activate" || body.action === "resume") {
      if (campaign.status === "CANCELED") {
        return NextResponse.json({ error: "Cannot resume a canceled campaign" }, { status: 400 });
      }
      const { canLegacyActivateCampaign } = await import("@/lib/mass-texting/campaign-guards");
      const gate = await canLegacyActivateCampaign(workspaceId, campaign.id);
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason || "Launch required" }, { status: 400 });
      }
      status = "SENDING";
    }
    if (body.action === "pause") status = "PAUSED";
    if (body.action === "cancel") status = "CANCELED";

    const updated = await getPrisma().campaign.update({
      where: { id: campaign.id },
      data: { status },
    });

    // Kick pending recipients when activating — preserve enroll delays via shared wait processor
    if (status === "SENDING") {
      const { processSequenceWaits } = await import("@/lib/campaigns/sequence-runner");
      await processSequenceWaits();
    }

    if (status === "CANCELED") {
      await getPrisma().campaignMessage.updateMany({
        where: { campaignId: campaign.id, status: "queued" },
        data: { status: "cancelled", error: "campaign_canceled" },
      });
      await getPrisma().campaignRecipient.updateMany({
        where: {
          campaignId: campaign.id,
          workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
        },
        data: {
          workflowStatus: "stopped",
          stopReason: "campaign_canceled",
          completedAt: new Date(),
          enrollmentKey: null,
          nextActionAt: null,
        },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 400);
  }
}
