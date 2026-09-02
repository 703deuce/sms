import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import {
  cancelBroadcastCampaign,
  duplicateBroadcastCampaign,
  getBroadcastCampaign,
  pauseBroadcastCampaign,
  resumeBroadcastCampaign,
  updateBroadcastCampaign,
} from "@/lib/mass-texting/broadcast/service";
import type { BroadcastCampaignInput } from "@/lib/mass-texting/broadcast/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;

    const campaign = await getBroadcastCampaign(auth.workspaceId, id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ data: campaign });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<BroadcastCampaignInput> & {
      action?: "duplicate" | "pause" | "resume";
    };

    if (body.action === "duplicate") {
      const copy = await duplicateBroadcastCampaign(auth.workspaceId, id, auth.session.email);
      return NextResponse.json({ data: copy });
    }
    if (body.action === "pause") {
      const paused = await pauseBroadcastCampaign(auth.workspaceId, id);
      return NextResponse.json({ data: paused });
    }
    if (body.action === "resume") {
      const resumed = await resumeBroadcastCampaign(auth.workspaceId, id);
      return NextResponse.json({ data: resumed });
    }

    const updated = await updateBroadcastCampaign(auth.workspaceId, id, body);
    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;

    const canceled = await cancelBroadcastCampaign(auth.workspaceId, id);
    return NextResponse.json({ data: canceled });
  } catch (err) {
    return jsonError(err, 400);
  }
}
