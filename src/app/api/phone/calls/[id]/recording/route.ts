import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

/**
 * Authenticated softphone recording playback proxy.
 * Raw Telnyx recording URLs often expire or require auth — stream via session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const call = await getPrisma().humanCall.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { recordingUrl: true },
    });
    if (!call?.recordingUrl) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const headers: Record<string, string> = {};
    const apiKey = getTelnyxApiKey();
    if (apiKey && /telnyx\.com/i.test(call.recordingUrl)) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(call.recordingUrl, { headers });
    if (!upstream.ok || !upstream.body) {
      // Fall back to redirect when proxy fetch fails (public/signed URL).
      return NextResponse.redirect(call.recordingUrl);
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
