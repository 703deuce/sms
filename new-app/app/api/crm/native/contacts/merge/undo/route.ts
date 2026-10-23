import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { undoContactMerge } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { mergeRecordId?: string };
    if (!body.mergeRecordId) {
      return NextResponse.json({ error: "mergeRecordId required" }, { status: 400 });
    }
    const data = await undoContactMerge(workspaceId, body.mergeRecordId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
