import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getNativeContactDetail } from "@/lib/server/crm/native/contact-detail";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const data = await getNativeContactDetail(workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
