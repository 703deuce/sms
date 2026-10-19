import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import {
  loadHumanCallForRecordingPlayback,
  resolveHumanCallRecordingForPlayback,
} from "@/lib/server/phone/recording-playback";
import { resolveWorkspaceId } from "@/lib/server/workspace";

async function streamRecording(request: Request, ctx: { params: Promise<{ id: string }> }, probeOnly: boolean) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const call = await loadHumanCallForRecordingPlayback(workspaceId, id);
    if (!call) {
      return NextResponse.json({ error: "No recording" }, { status: 404 });
    }

    const downloadUrl = await resolveHumanCallRecordingForPlayback(call);
    if (!downloadUrl) {
      return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
    }

    const range = request.headers.get("range");
    // Telnyx/S3 presigned URLs often reject HEAD (403) while GET works — probe with a tiny ranged GET.
    const upstream = await fetch(downloadUrl, {
      redirect: "follow",
      method: "GET",
      headers: probeOnly
        ? { Range: "bytes=0-0" }
        : range
          ? { Range: range }
          : undefined,
    });
    const probeOk = probeOnly && (upstream.ok || upstream.status === 206);
    if (!probeOk && !upstream.ok) {
      return NextResponse.json(
        { error: "Recording unavailable", upstreamStatus: upstream.status },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges");
    const headers = {
      "Content-Type": contentType,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
      ...(contentRange ? { "Content-Range": contentRange } : {}),
      ...(acceptRanges ? { "Accept-Ranges": acceptRanges } : { "Accept-Ranges": "bytes" }),
      "Cache-Control": "private, max-age=300",
    };

    if (probeOnly) {
      try {
        await upstream.arrayBuffer();
      } catch {
        /* body optional for probe */
      }
      return new NextResponse(null, { status: 200, headers });
    }

    if (!upstream.body) {
      return NextResponse.json({ error: "Recording unavailable" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

/** Stream recording through our origin (fresh Telnyx URL — stored presigns expire in ~10m). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return streamRecording(request, ctx, false);
}

export async function HEAD(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return streamRecording(request, ctx, true);
}
