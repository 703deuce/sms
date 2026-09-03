import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  deleteDripCampaign,
  duplicateDripCampaign,
  getDripCampaign,
  updateDripCampaign,
} from "@/lib/drip-campaigns/service";
import type { CreateDripCampaignInput } from "@/lib/drip-campaigns/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getDripCampaign(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as Partial<CreateDripCampaignInput> & {
      action?: "duplicate" | "toggle_status";
    };

    if (body.action === "duplicate") {
      const data = await duplicateDripCampaign(auth.workspaceId, id);
      return NextResponse.json({ data, created: true }, { status: 201 });
    }

    if (body.action === "toggle_status") {
      const current = await getDripCampaign(auth.workspaceId, id);
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const nextStatus =
        current.status === "active"
          ? "paused"
          : current.status === "draft"
            ? "active"
            : "active";
      const data = await updateDripCampaign(auth.workspaceId, id, { status: nextStatus });
      return NextResponse.json({ data });
    }

    const { action: _action, ...updates } = body;
    const data = await updateDripCampaign(auth.workspaceId, id, updates);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    await deleteDripCampaign(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
