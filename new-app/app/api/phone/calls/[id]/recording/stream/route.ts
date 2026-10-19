import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

/** Stream recording through our origin so mobile Safari can play Telnyx S3 URLs reliably. */
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

    const upstream = await fetch(call.recordingUrl, { redirect: "follow" });
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
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
