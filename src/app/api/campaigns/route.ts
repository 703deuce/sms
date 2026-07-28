import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign, validateBulkRecipients } from "@/lib/campaigns/enroll-campaign";
import { defaultSmsEmailSequence, parseSequence } from "@/lib/campaigns/sequence-engine";
import { advanceRecipient } from "@/lib/campaigns/sequence-runner";

export async function GET() {
  try {
    const auth = await requireSession();
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
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      workspaceId?: string;
      name?: string;
      type?: string;
      audience?: string;
      message?: string;
      body?: string;
      sequenceJson?: unknown;
      successMode?: string;
      dailySendLimit?: number;
      sendWindowStart?: number;
      sendWindowEnd?: number;
      scheduledAt?: string;
      recipients?: Array<{ phone?: string; email?: string; displayName?: string }>;
      activate?: boolean;
    };

    const workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
    const name = body.name?.trim();
    const message = (body.message || body.body || "").trim();
    if (!name || !message) {
      return NextResponse.json({ error: "name and message are required" }, { status: 400 });
    }

    const sequenceJson = body.sequenceJson
      ? parseSequence(body.sequenceJson)
      : defaultSmsEmailSequence();

    const campaign = await getPrisma().campaign.create({
      data: {
        workspaceId,
        name,
        type: body.type || "Sequence",
        audience: body.audience || "Custom",
        body: message,
        status: body.activate ? "SENDING" : body.scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        sequenceJson: sequenceJson as Prisma.InputJsonValue,
        successMode: body.successMode || "click",
        dailySendLimit: body.dailySendLimit,
        sendWindowStart: body.sendWindowStart,
        sendWindowEnd: body.sendWindowEnd,
        createdBy: auth.session.email,
      },
    });

    const { accepted, rejected } = await validateBulkRecipients(
      workspaceId,
      campaign.id,
      body.recipients || [],
    );

    const enrolled = [];
    for (const r of accepted) {
      enrolled.push(
        await enrollContactInCampaign({
          workspaceId,
          campaignId: campaign.id,
          phone: r.phone,
          email: r.email,
          displayName: r.displayName,
        }),
      );
    }

    return NextResponse.json(
      { data: { campaign, enrolledCount: enrolled.length, rejected } },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}

/** Activate / pause / resume / cancel a campaign. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
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
    if (body.action === "activate" || body.action === "resume") status = "SENDING";
    if (body.action === "pause") status = "PAUSED";
    if (body.action === "cancel") status = "CANCELED";

    const updated = await getPrisma().campaign.update({
      where: { id: campaign.id },
      data: { status },
    });

    // Kick pending recipients when activating
    if (status === "SENDING") {
      const pending = await getPrisma().campaignRecipient.findMany({
        where: { campaignId: campaign.id, workflowStatus: "pending" },
        take: 200,
      });
      for (const r of pending) {
        await getPrisma().campaignRecipient.update({
          where: { id: r.id },
          data: { workflowStatus: "in_progress" },
        });
        await advanceRecipient(r.id);
      }
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
        data: { workflowStatus: "stopped", stopReason: "campaign_canceled", completedAt: new Date() },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 400);
  }
}
