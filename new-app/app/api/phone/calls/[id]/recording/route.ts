import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const call = await prisma.humanCall.findFirst({
      where: { id, workspaceId },
      select: { recordingUrl: true },
    });
    if (!call?.recordingUrl) {
      return NextResponse.json({ error: "No recording" }, { status: 404 });
    }
    return NextResponse.json({ data: { url: call.recordingUrl } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
