import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { enrollContactInCampaign } from "@/lib/campaigns/enroll-campaign";
import { defaultSmsEmailSequence, parseSequence } from "@/lib/campaigns/sequence-engine";

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
      scheduledAt?: string;
      recipients?: Array<{ phone?: string; email?: string; displayName?: string }>;
      activate?: boolean;
    };

    const workspaceId = body.workspaceId || auth.workspaceId;
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
        createdBy: auth.session.email,
      },
    });

    const enrolled = [];
    for (const r of body.recipients || []) {
      if (!r.phone && !r.email) continue;
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

    return NextResponse.json({ data: { campaign, enrolledCount: enrolled.length } }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
