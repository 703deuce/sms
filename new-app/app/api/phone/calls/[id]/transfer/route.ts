import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { transferHumanCall } from "@/lib/server/phone/transfer";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { to?: string };
    if (!body.to?.trim()) {
      return NextResponse.json({ error: "Transfer destination required" }, { status: 400 });
    }
    const call = await transferHumanCall({
      workspaceId,
      humanCallId: id,
      toE164: body.to.trim(),
    });
    return NextResponse.json({ data: { id: call.id, status: call.status, disposition: call.disposition } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
