import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { deleteSavedView, upsertSavedView } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const body = await request.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const data = await upsertSavedView(workspaceId, {
      id,
      name: body.name,
      filtersJson: (body.filtersJson || {}) as Record<string, unknown>,
      pinned: body.pinned,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const data = await deleteSavedView(workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
