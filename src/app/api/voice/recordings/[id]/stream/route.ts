import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { verifyRecordingAccessToken } from "@/lib/voice/recordings";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";
  const verified = verifyRecordingAccessToken(token);
  if (!verified || verified.recordingId !== id) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  const rec = await getPrisma().voiceRecording.findFirst({
    where: { id, workspaceId: verified.workspaceId },
  });
  if (!rec?.storageUrl) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const { parseVoicemailStorageRecordingUrl } = await import(
    "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-storage"
  );
  const { createSignedRecordingUrl } = await import(
    "@/lib/smart-routing/call-recording-storage"
  );
  const parsed = parseVoicemailStorageRecordingUrl(rec.storageUrl);
  if (parsed) {
    const signed = await createSignedRecordingUrl(parsed.bucket, parsed.path, 3600);
    return NextResponse.redirect(signed);
  }

  return NextResponse.redirect(rec.storageUrl);
}
