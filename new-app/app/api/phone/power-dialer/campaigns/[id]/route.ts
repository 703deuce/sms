import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { updateCampaign } from "@/lib/server/phone/power-dialer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    await updateCampaign(workspaceId, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      configJson: body.configJson as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
