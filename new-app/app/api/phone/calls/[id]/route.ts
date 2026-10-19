import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getCallDetail, patchCall } from "@/lib/server/phone/calls-service";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const data = await getCallDetail(workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const data = await patchCall(workspaceId, id, {
      handled: typeof body.handled === "boolean" ? body.handled : undefined,
      disposition: typeof body.disposition === "string" ? body.disposition : undefined,
      callbackNeeded: typeof body.callbackNeeded === "boolean" ? body.callbackNeeded : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
