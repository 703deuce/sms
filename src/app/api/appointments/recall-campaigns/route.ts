import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteRecallCampaign,
  listRecallCampaigns,
  newRecallCampaign,
  runRecallCampaign,
  saveRecallCampaign,
} from "@/lib/appointments/recall-campaigns";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listRecallCampaigns(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { action?: string; campaign?: object; campaignId?: string };
    if (body.action === "run" && body.campaignId) {
      const result = await runRecallCampaign(auth.workspaceId, body.campaignId);
      return NextResponse.json({ data: result });
    }
    const campaign = body.campaign
      ? await saveRecallCampaign(auth.workspaceId, body.campaign as import("@/lib/appointments/scheduling-capabilities").RecallCampaign)
      : await saveRecallCampaign(auth.workspaceId, newRecallCampaign());
    return NextResponse.json({ data: campaign });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteRecallCampaign(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
