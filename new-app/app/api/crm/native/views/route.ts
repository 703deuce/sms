import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listSavedViews, upsertSavedView } from "@/lib/server/crm/native/contacts-admin";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listSavedViews(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const data = await upsertSavedView(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
