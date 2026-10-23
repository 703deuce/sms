import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { deleteOrArchiveContact } from "@/lib/server/contact-lifecycle";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const result = await deleteOrArchiveContact(workspaceId, id);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
