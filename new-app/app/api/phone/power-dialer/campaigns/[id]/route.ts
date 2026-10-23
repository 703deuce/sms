import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getCampaignDetail, upsertCampaign } from "@/lib/server/phone/power-dialer/campaign-admin";
import { updateCampaign } from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const detail = await getCampaignDetail(workspaceId, id);
    const c = detail.campaign;
    return NextResponse.json({
      data: {
        id: c.id,
        name: c.name,
        description: c.description,
        listId: c.listId,
        callerIdE164: c.callerIdE164,
        timezone: c.timezone,
        status: c.status,
        rules: detail.rules,
        extended: detail.extended,
        eligibility: detail.eligibility,
        configJson: c.configJson,
      },
    });
  } catch (err) {
    return jsonError(err, 404);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "archive") {
      await updateCampaign(workspaceId, id, { status: "archived" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "pause") {
      await updateCampaign(workspaceId, id, { status: "paused" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "resume") {
      await updateCampaign(workspaceId, id, { status: "active" });
      return NextResponse.json({ ok: true });
    }
    const data = await upsertCampaign(workspaceId, {
      id,
      name: String(body.name || ""),
      description: typeof body.description === "string" ? body.description : undefined,
      listId: String(body.listId || ""),
      callerIdE164: String(body.callerIdE164 || body.callerId || ""),
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      configJson: (body.configJson || body.config || {}) as Record<string, unknown>,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
