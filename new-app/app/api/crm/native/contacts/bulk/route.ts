import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { bulkPatchContacts } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      contactIds?: string[];
      patch?: { ownerUserId?: string; folderId?: string | null; leadStage?: string; tagIds?: string[] };
    };
    const contactIds = body.contactIds || [];
    if (!contactIds.length) return NextResponse.json({ error: "contactIds required" }, { status: 400 });
    const data = await bulkPatchContacts(workspaceId, contactIds, body.patch || {});
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
