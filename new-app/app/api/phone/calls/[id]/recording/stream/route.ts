import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveHumanCallRecordingDownloadUrl } from "@/lib/server/phone/resolve-recording-url";
import { resolveWorkspaceId } from "@/lib/server/workspace";

/** Stream recording through our origin (fresh Telnyx URL — stored presigns expire in ~10m). */
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

    const downloadUrl = await resolveHumanCallRecordingDownloadUrl(call);
    if (!downloadUrl) {
      return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
    }

    const upstream = await fetch(downloadUrl, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
