import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveHumanCallRecordingDownloadUrl } from "@/lib/server/phone/resolve-recording-url";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const call = await prisma.humanCall.findFirst({
      where: { id, workspaceId },
      select: {
        recordingUrl: true,
        telnyxCallControlId: true,
        metadata: true,
      },
    });
    if (!call?.recordingUrl) {
      return NextResponse.json({ error: "No recording" }, { status: 404 });
    }
    const url = await resolveHumanCallRecordingDownloadUrl(call);
    if (!url) {
      return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
    }
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
