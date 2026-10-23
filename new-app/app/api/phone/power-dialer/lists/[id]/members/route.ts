import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import {
  addContactsToList,
  removeContactsFromList,
} from "@/lib/server/phone/power-dialer/list-members";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: listId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      action?: "add" | "remove";
      contactIds?: string[];
    };
    const contactIds = body.contactIds || [];
    if (body.action === "remove") {
      const data = await removeContactsFromList(workspaceId, listId, contactIds);
      return NextResponse.json({ data });
    }
    const data = await addContactsToList(workspaceId, listId, contactIds);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
