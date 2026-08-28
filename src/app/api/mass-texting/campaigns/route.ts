import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import {
  createBroadcastCampaign,
  listBroadcastCampaigns,
} from "@/lib/mass-texting/broadcast/service";
import type { BroadcastCampaignInput } from "@/lib/mass-texting/broadcast/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);

    const url = new URL(request.url);
    const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") || 50)));
    const skip = Math.max(0, Number(url.searchParams.get("skip") || 0));
    const status = url.searchParams.get("status") || undefined;

    const campaigns = await listBroadcastCampaigns(auth.workspaceId, { take, skip, status });
    return NextResponse.json({ data: campaigns, take, skip });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);

    const body = (await request.json()) as BroadcastCampaignInput;
    const campaign = await createBroadcastCampaign(
      auth.workspaceId,
      body,
      auth.session.email,
    );
    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
