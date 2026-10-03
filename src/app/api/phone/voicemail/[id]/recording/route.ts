import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import { createSignedRecordingUrl } from "@/lib/smart-routing/call-recording-storage";
import { parseAnyVoicemailRecordingStorageRef } from "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage";

/** Authenticated voicemail recording playback proxy. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const msg = await getPrisma().voicemailMessage.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { recordingUrl: true },
    });
    if (!msg?.recordingUrl) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const storageRef = parseAnyVoicemailRecordingStorageRef(msg.recordingUrl);
    if (storageRef) {
      const signedUrl = await createSignedRecordingUrl(storageRef.bucket, storageRef.path, 3600);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json({ error: "Recording not found" }, { status: 404 });
      }
      const contentType = upstream.headers.get("content-type") || "audio/mpeg";
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const headers: Record<string, string> = {};
    const apiKey = getTelnyxApiKey();
    if (apiKey && /telnyx\.com/i.test(msg.recordingUrl)) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(msg.recordingUrl, { headers });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.redirect(msg.recordingUrl);
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
