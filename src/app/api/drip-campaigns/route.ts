import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createDripCampaign, listDripCampaigns } from "@/lib/drip-campaigns/service";
import type { CreateDripCampaignInput } from "@/lib/drip-campaigns/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listDripCampaigns(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as CreateDripCampaignInput;
    const data = await createDripCampaign(auth.workspaceId, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
