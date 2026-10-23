import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { createDeal, listDealsBoard } from "@/lib/server/crm/native/deals";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listDealsBoard(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = await request.json();
    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
    const data = await createDeal(workspaceId, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
