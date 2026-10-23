import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPowerDialerSessionSummary } from "@/lib/server/phone/power-dialer/session-summary";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const data = await getPowerDialerSessionSummary(workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 404);
  }
}
