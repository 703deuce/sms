import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/server/api-error";
import { markVoicemailMessageRead } from "@/lib/server/phone/voicemail-inbox";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireSession();
    const { id } = await params;
    const body = (await request.json()) as { isRead?: boolean };
    const ok = await markVoicemailMessageRead(workspaceId, id, body.isRead !== false);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
