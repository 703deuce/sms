import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getMeetingTranscriptDownloadResponse } from "@/lib/meeting-assistant/transcript-export";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { sessionId } = await params;
    const download = await getMeetingTranscriptDownloadResponse(auth.workspaceId, sessionId);
    if (!download) return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    return new NextResponse(download.body, {
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": `attachment; filename="${download.filename}"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
