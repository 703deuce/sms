import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/server/api-error";
import { listVoicemailInboxMessages } from "@/lib/server/phone/voicemail-inbox";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireSession();
    const url = new URL(request.url);
    const phoneNumberId = url.searchParams.get("phoneNumberId") || undefined;
    const limit = url.searchParams.get("limit");
    const messages = await listVoicemailInboxMessages(workspaceId, {
      phoneNumberId,
      limit: limit ? Number(limit) : undefined,
    });
    return NextResponse.json({ data: { messages } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
