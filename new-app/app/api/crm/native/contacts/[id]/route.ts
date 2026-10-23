import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getNativeContactDetail } from "@/lib/server/crm/native/contact-detail";
import { addContactNote, patchNativeContact, reassignContactOwner } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const includeRecordings = url.searchParams.get("recordings") === "1";
    const data = await getNativeContactDetail(workspaceId, id, { includeRecordings });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "reassign_owner") {
      const data = await reassignContactOwner(
        workspaceId,
        id,
        String(body.ownerUserId || ""),
        body.allowCrossRep === true,
      );
      return NextResponse.json({ data });
    }
    if (body.action === "add_note") {
      const data = await addContactNote(workspaceId, id, String(body.body || ""));
      return NextResponse.json({ data });
    }
    const data = await patchNativeContact(workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
