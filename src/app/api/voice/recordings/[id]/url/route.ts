import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getSignedRecordingUrl } from "@/lib/voice/recordings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getSignedRecordingUrl(auth.workspaceId, id, auth.session.userId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
